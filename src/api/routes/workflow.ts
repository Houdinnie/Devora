import { Router, Request, Response } from 'express';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { parse } from 'yaml';
import { z } from 'zod';
import { executeWorkflow, StepCheckpoint } from '../../orchestrator/engine.js';
import { listAvailableWorkflows, loadWorkflow } from '../../orchestrator/workflow.js';
import { sessionStore } from '../../memory/session.js';
import { createSSEStream } from '../../streaming/sse.js';
import { db } from '../../db/client.js';

const router = Router();
const activeWorkflowControllers = new Map<string, AbortController>();
const RunWorkflowSchema = z.object({
  workflow: z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/, 'Invalid workflow name'),
  inputs: z.record(z.unknown()).optional(),
  sessionId: z.string().uuid().optional(),
  stream: z.boolean().default(false),
  // The worktree manager enforces the DEVORA_REPOSITORIES_DIR allow-list.
  repositoryPath: z.string().min(1).max(2048).optional(),
  baseRef: z.string().min(1).max(120).optional(),
});

function persistCheckpoint(runId: string, event: StepCheckpoint): Promise<unknown> {
  return db.query(
    `INSERT INTO workflow_run_steps
      (workflow_run_id, step_id, agent_id, status, attempt, output_text, error_message, worktree_path,
       started_at, updated_at, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
       CASE WHEN $4 = 'running' THEN NOW() ELSE NULL END, NOW(),
       CASE WHEN $4 IN ('completed', 'failed', 'skipped') THEN NOW() ELSE NULL END)
     ON CONFLICT (workflow_run_id, step_id) DO UPDATE SET
       agent_id = EXCLUDED.agent_id,
       status = EXCLUDED.status,
       attempt = GREATEST(workflow_run_steps.attempt, EXCLUDED.attempt),
       output_text = COALESCE(EXCLUDED.output_text, workflow_run_steps.output_text),
       error_message = EXCLUDED.error_message,
       worktree_path = COALESCE(EXCLUDED.worktree_path, workflow_run_steps.worktree_path),
       started_at = COALESCE(workflow_run_steps.started_at, EXCLUDED.started_at),
       updated_at = NOW(),
       completed_at = CASE WHEN EXCLUDED.status IN ('completed', 'failed', 'skipped') THEN NOW()
                           ELSE workflow_run_steps.completed_at END`,
    [runId, event.stepId, event.agentId, event.status, event.attempt || 0,
      event.output ?? null, event.error ?? null, event.worktreePath ?? null]
  );
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const workflows = await listAvailableWorkflows();
    res.json({ count: workflows.length, workflows: workflows.map(w => ({
      name: w.name, description: w.description, steps: w.steps?.length || 0, category: w.category || 'general',
    })) });
  } catch {
    res.status(500).json({ error: 'Failed to list workflows' });
  }
});

router.post('/runs/:runId/cancel', async (req: Request, res: Response) => {
  const runId = req.params.runId;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)) {
    res.status(400).json({ error: 'Invalid run id' }); return;
  }
  try {
    await db.query(`UPDATE workflow_runs SET cancel_requested_at = COALESCE(cancel_requested_at, NOW())
      WHERE id = $1 AND status = 'running'`, [runId]);
    const controller = activeWorkflowControllers.get(runId);
    if (controller) controller.abort();
    const status = await db.query<{ status: string }>('SELECT status FROM workflow_runs WHERE id = $1', [runId]);
    if (!controller && status.rows[0]?.status !== 'running') {
      res.status(409).json({ error: 'Workflow is not active or has already finished', runId }); return;
    }
    res.status(202).json({ success: true, runId, status: 'cancellation_requested' });
  } catch {
    res.status(500).json({ error: 'Failed to request workflow cancellation' });
  }
});

router.get('/runs/:runId', async (req: Request, res: Response) => {
  const runId = req.params.runId;
  if (!/^[0-9a-f-]{36}$/i.test(runId)) { res.status(400).json({ error: 'Invalid run id' }); return; }
  try {
    const run = await db.query<Record<string, unknown>>(
      'SELECT id, session_id, workflow_name, status, inputs, outputs, agent_results, error_message, cancel_requested_at, created_at, started_at, completed_at FROM workflow_runs WHERE id = $1',
      [runId]
    );
    if (!run.rows.length) { res.status(404).json({ error: 'Workflow run not found' }); return; }
    const steps = await db.query<Record<string, unknown>>(
      'SELECT step_id, agent_id, status, attempt, output_text, error_message, worktree_path, started_at, updated_at, completed_at FROM workflow_run_steps WHERE workflow_run_id = $1 ORDER BY started_at NULLS FIRST, step_id',
      [runId]
    );
    res.json({ run: run.rows[0], steps: steps.rows });
  } catch {
    res.status(500).json({ error: 'Failed to fetch workflow run' });
  }
});

router.get('/:name', async (req: Request, res: Response) => {
  const name = req.params.name;
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(name)) { res.status(400).json({ error: 'Invalid workflow name' }); return; }
  try {
    const workflowsDir = process.env.WORKFLOWS_DIR || './workflows';
    const content = await readFile(join(workflowsDir, `${name}.yaml`), 'utf-8');
    res.json(parse(content));
  } catch {
    res.status(404).json({ error: 'Workflow not found', name });
  }
});

router.post('/run', async (req: Request, res: Response) => {
  let runId: string | undefined;
  let controller: AbortController | undefined;
  let cancelPoll: ReturnType<typeof setInterval> | undefined;
  try {
    const { workflow: workflowName, inputs, sessionId, stream, repositoryPath, baseRef } = RunWorkflowSchema.parse(req.body);
    if (repositoryPath && !process.env.DEVORA_REPOSITORIES_DIR) {
      res.status(400).json({ error: 'Worktree execution requires DEVORA_REPOSITORIES_DIR to be configured' }); return;
    }
    const workflow = await loadWorkflow(workflowName);
    if (!workflow) { res.status(404).json({ error: 'Workflow not found', workflow: workflowName }); return; }

    let session = sessionId ? await sessionStore.get(sessionId) : null;
    if (!session) session = await sessionStore.create({ name: `Workflow: ${workflowName}`, metadata: { workflow: workflowName } });
    const runResult = await db.query<{ id: string }>(
      `INSERT INTO workflow_runs (session_id, workflow_name, status, inputs, started_at)
       VALUES ($1, $2, 'running', $3, NOW()) RETURNING id`,
      [session.id, workflowName, JSON.stringify(inputs || {})]
    );
    if (!runResult.rows[0]?.id) throw new Error('Could not create workflow run; check DATABASE_URL and database schema');
    runId = runResult.rows[0].id;
    controller = new AbortController();
    activeWorkflowControllers.set(runId, controller);

    // Persisted cancellation works across API instances; the in-memory controller makes same-process cancellation immediate.
    let pollInFlight = false;
    cancelPoll = setInterval(async () => {
      if (pollInFlight || !runId || !controller || controller.signal.aborted) return;
      pollInFlight = true;
      try {
        const requested = await db.query<{ cancel_requested_at: string | null }>(
          'SELECT cancel_requested_at FROM workflow_runs WHERE id = $1', [runId]
        );
        if (requested.rows[0]?.cancel_requested_at) controller.abort();
      } catch { /* transient database failures are retried on the next poll */ }
      finally { pollInFlight = false; }
    }, 750);
    cancelPoll.unref?.();

    const execute = () => executeWorkflow(workflowName, inputs || {}, {
      sessionId: session!.id, signal: controller!.signal, inputs: inputs || {}, outputs: {},
      runId, repositoryPath, baseRef,
      onStepCheckpoint: (event) => persistCheckpoint(runId!, event).then(() => undefined),
    });

    if (stream) {
      const sse = createSSEStream(res);
      sse.sendEvent('start', { workflow: workflowName, runId });
      try {
        const result = await executeWorkflow(workflowName, inputs || {}, {
          sessionId: session.id, signal: controller.signal, inputs: inputs || {}, outputs: {},
          runId, repositoryPath, baseRef,
          onStepCheckpoint: (event) => persistCheckpoint(runId!, event).then(() => undefined),
          stream: {
            onAgentStart: (agentId, step) => { sse.agentStart(agentId, step); },
            onAgentComplete: (agentId, output) => { sse.agentComplete(agentId, output); },
            onAgentFailed: (agentId, error) => { sse.agentFailed(agentId, error); },
            onProgress: (current, total) => { sse.workflowProgress(current, total); },
          },
        });
        await db.query(
          'UPDATE workflow_runs SET status = $1, outputs = $2, agent_results = $3, error_message = $4, completed_at = NOW() WHERE id = $5',
          [result.status, JSON.stringify(result.outputs), JSON.stringify(result.agentResults), result.error || null, runId]
        );
        if (result.status === 'completed') sse.workflowComplete(result.outputs);
        else if (result.status === 'cancelled') sse.sendEvent('cancelled', { runId, error: result.error });
        else sse.workflowFailed(result.error || 'Workflow failed');
        sse.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Workflow failed';
        await db.query("UPDATE workflow_runs SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2", [message, runId]);
        sse.error('Workflow execution failed'); sse.close();
      } finally {
        if (cancelPoll) clearInterval(cancelPoll);
        activeWorkflowControllers.delete(runId);
      }
      return;
    }

    const result = await execute();
    await db.query(
      'UPDATE workflow_runs SET status = $1, outputs = $2, agent_results = $3, error_message = $4, completed_at = NOW() WHERE id = $5',
      [result.status, JSON.stringify(result.outputs), JSON.stringify(result.agentResults), result.error || null, runId]
    );
    await sessionStore.updateActivity(session.id);
    res.json({
      success: result.status === 'completed', runId, workflow: workflowName, status: result.status,
      outputs: result.outputs, agentResults: result.agentResults, totalDuration: result.totalDuration, error: result.error,
    });
  } catch (error) {
    const message = error instanceof z.ZodError ? 'Invalid workflow run request' : 'Workflow execution failed';
    if (!res.headersSent) res.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
    if (runId) {
      try { await db.query("UPDATE workflow_runs SET status = 'failed', completed_at = NOW() WHERE id = $1 AND status = 'running'", [runId]); } catch {}
    }
  } finally {
    if (cancelPoll) clearInterval(cancelPoll);
    if (runId) activeWorkflowControllers.delete(runId);
  }
});

export default router;
