import { Router, Request, Response } from 'express';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { parse } from 'yaml';
import { z } from 'zod';
import { executeWorkflow } from '../../orchestrator/engine.js';
import { listAvailableWorkflows } from '../../orchestrator/workflow.js';
import { sessionStore } from '../../memory/session.js';
import { createSSEStream } from '../../streaming/sse.js';
import { db } from '../../db/client.js';

const router = Router();

const RunWorkflowSchema = z.object({
  workflow: z.string().min(1),
  inputs: z.record(z.unknown()).optional(),
  sessionId: z.string().uuid().optional(),
  stream: z.boolean().default(false),
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const workflows = await listAvailableWorkflows();
    
    res.json({
      count: workflows.length,
      workflows: workflows.map(w => ({
        name: w.name,
        description: w.description,
        steps: w.steps?.length || 0,
        category: w.category || 'general',
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list workflows' });
  }
});

router.get('/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const workflowsDir = process.env.WORKFLOWS_DIR || './workflows';
    const filePath = join(workflowsDir, `${name}.yaml`);
    
    const content = await readFile(filePath, 'utf-8');
    const workflow = parse(content);
    
    res.json(workflow);
  } catch (error) {
    res.status(404).json({ error: 'Workflow not found', name: req.params.name });
  }
});

router.post('/run', async (req: Request, res: Response) => {
  try {
    const { workflow: workflowName, inputs, sessionId, stream } = RunWorkflowSchema.parse(req.body);
    
    let session = sessionId ? await sessionStore.get(sessionId) : null;
    
    if (!session) {
      session = await sessionStore.create({
        name: `Workflow: ${workflowName}`,
        metadata: { workflow: workflowName },
      });
    }
    
    const runResult = await db.query<{ id: string }>(
      `INSERT INTO workflow_runs (session_id, workflow_name, status, inputs)
       VALUES ($1, $2, 'running', $3)
       RETURNING *`,
      [session.id, workflowName, JSON.stringify(inputs || {})]
    );
    
    const runId = runResult.rows[0].id;
    
    if (stream) {
      const sse = createSSEStream(res);
      
      sse.sendEvent('start', { workflow: workflowName, runId });
      
      try {
        const result = await executeWorkflow(workflowName, inputs || {}, {
          sessionId: session.id,
          inputs: inputs || {},
          outputs: {},
          stream: {
            onAgentStart: (agentId, step) => { sse.agentStart(agentId, step); },
            onAgentComplete: (agentId, output) => { sse.agentComplete(agentId, output); },
            onAgentFailed: (agentId, error) => { sse.agentFailed(agentId, error); },
            onProgress: (current, total) => { sse.workflowProgress(current, total); },
          },
        });
        
        await db.query(
          `UPDATE workflow_runs SET status = $1, outputs = $2, completed_at = NOW()
           WHERE id = $3`,
          [result.status, JSON.stringify(result.outputs), runId]
        );
        
        if (result.status === 'completed') {
          sse.workflowComplete(result.outputs);
        } else {
          sse.workflowFailed(result.error || 'Workflow failed');
        }
        
        sse.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Workflow failed';
        
        await db.query(
          `UPDATE workflow_runs SET status = 'failed', error_message = $1, completed_at = NOW()
           WHERE id = $2`,
          [errorMessage, runId]
        );
        
        sse.error(errorMessage);
        sse.close();
      }
      
      return;
    }
    
    const result = await executeWorkflow(workflowName, inputs || {}, {
      inputs: inputs || {},
      outputs: {},
      sessionId: session.id,
    });
    
    await db.query(
      `UPDATE workflow_runs SET status = $1, outputs = $2, agent_results = $3,
       completed_at = NOW()
       WHERE id = $4`,
      [
        result.status,
        JSON.stringify(result.outputs),
        JSON.stringify(result.agentResults),
        runId,
      ]
    );
    
    await sessionStore.updateActivity(session.id);
    
    res.json({
      success: result.status === 'completed',
      runId,
      workflow: workflowName,
      status: result.status,
      outputs: result.outputs,
      agentResults: result.agentResults,
      totalDuration: result.totalDuration,
      error: result.error,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Workflow execution failed';
    res.status(400).json({ error: 'Workflow execution failed', message });
  }
});

export default router;