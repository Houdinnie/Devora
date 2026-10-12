import { llmManager } from './llm-manager.js';
import { listAgents, getAgentContent } from './agent-registry.js';
import { loadWorkflow, WorkflowContext, WorkflowStep } from './workflow.js';
import { SSEStream } from '../streaming/sse.js';
import { createIsolatedWorktree } from './worktree-manager.js';

export interface AgentExecutionResult {
  success: boolean; output: string; duration: number;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  error?: string;
}
export interface WorkflowExecutionResult {
  workflowId: string; status: 'completed' | 'failed' | 'partial' | 'cancelled';
  outputs: Record<string, string>;
  agentResults: Array<{ agentId: string; stepId: string; output: string; duration: number; success: boolean; error?: string }>;
  totalDuration: number; error?: string;
}
export interface StepCheckpoint {
  stepId: string; agentId: string; status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  attempt?: number; output?: string; error?: string; worktreePath?: string;
}
export interface WorkflowExecutionOptions extends Partial<WorkflowContext> {
  signal?: AbortSignal; concurrency?: number; defaultRetries?: number; defaultTimeoutMs?: number;
  runId?: string; repositoryPath?: string; baseRef?: string;
  onStepCheckpoint?: (checkpoint: StepCheckpoint) => Promise<void> | void;
}
const abortError = () => new Error('Workflow cancelled');
function throwIfAborted(signal?: AbortSignal): void { if (signal?.aborted) throw abortError(); }
function boundedInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value!))) : fallback;
}
async function checkpoint(options: WorkflowExecutionOptions | undefined, event: StepCheckpoint): Promise<void> {
  try { await options?.onStepCheckpoint?.(event); } catch (error) {
    console.error('Workflow checkpoint write failed', { stepId: event.stepId, error: error instanceof Error ? error.message : 'unknown' });
  }
}
function safeStepSuffix(id: string): string {
  const suffix = id.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 40);
  return suffix || 'step';
}

export async function executeAgent(
  agentId: string, task: string,
  options?: { sessionId?: string; context?: Record<string, unknown>; stream?: SSEStream; signal?: AbortSignal; timeoutMs?: number }
): Promise<AgentExecutionResult> {
  const startTime = Date.now();
  try {
    throwIfAborted(options?.signal);
    const agentContent = await getAgentContent(agentId);
    if (!agentContent) return { success: false, output: '', duration: Date.now() - startTime, error: `Agent not found: ${agentId}` };
    const systemPrompt = `${agentContent}\n\n---\nTask: ${task}\n${options?.context ? `\nContext:\n${JSON.stringify(options.context, null, 2)}` : ''}\n`;
    const config = { timeout_ms: options?.timeoutMs ?? 120000 };
    if (options?.stream) {
      options.stream.agentRunning(agentId);
      let fullOutput = '';
      for await (const chunk of llmManager.stream(systemPrompt, config, options?.signal)) {
        throwIfAborted(options?.signal); fullOutput += chunk.delta;
        options.stream.agentRunning(agentId, undefined, { partial: chunk.delta });
      }
      return { success: true, output: fullOutput, duration: Date.now() - startTime };
    }
    const response = await llmManager.complete(systemPrompt, config, options?.signal);
    throwIfAborted(options?.signal);
    return { success: true, output: response.content, duration: Date.now() - startTime, usage: response.usage };
  } catch (error) {
    return { success: false, output: '', duration: Date.now() - startTime, error: error instanceof Error ? error.message : 'Execution failed' };
  }
}

export async function executeWorkflow(
  workflowName: string, inputs: Record<string, unknown>, options?: WorkflowExecutionOptions
): Promise<WorkflowExecutionResult> {
  const startTime = Date.now();
  const empty = (status: WorkflowExecutionResult['status'], error?: string): WorkflowExecutionResult => ({
    workflowId: workflowName, status, outputs: {}, agentResults: [], totalDuration: Date.now() - startTime, error,
  });
  const workflow = await loadWorkflow(workflowName);
  if (!workflow) return empty('failed', `Workflow not found: ${workflowName}`);
  if (options?.signal?.aborted) return empty('cancelled', 'Workflow cancelled');
  const steps = workflow.steps || [];
  if (!steps.length) return empty('completed');
  const byId = new Map<string, WorkflowStep>();
  for (const step of steps) {
    if (!step.id || byId.has(step.id)) return empty('failed', `Workflow has a missing or duplicate step id: ${step.id}`);
    byId.set(step.id, step);
  }
  for (const step of steps) for (const dep of step.depends_on || []) {
    if (!byId.has(dep)) return empty('failed', `Step ${step.id} depends on unknown step ${dep}`);
  }

  const concurrency = boundedInteger(options?.concurrency ?? workflow.concurrency, 3, 1, 16);
  const retries = boundedInteger(options?.defaultRetries, 1, 0, 5);
  const timeoutDefault = boundedInteger(options?.defaultTimeoutMs, 120000, 1000, 600000);
  const outputs: Record<string, string> = {};
  const results: WorkflowExecutionResult['agentResults'] = [];
  const state = new Map<string, 'pending' | 'running' | 'completed' | 'failed' | 'skipped'>();
  const stepOutput = new Map<string, string>();
  const failureReasons = new Map<string, string>();
  for (const step of steps) { state.set(step.id, 'pending'); await checkpoint(options, { stepId: step.id, agentId: step.agent, status: 'pending' }); }

  const runStep = async (step: WorkflowStep): Promise<void> => {
    if (options?.signal?.aborted) {
      state.set(step.id, 'skipped'); failureReasons.set(step.id, 'Workflow cancelled');
      await checkpoint(options, { stepId: step.id, agentId: step.agent, status: 'skipped', error: 'Workflow cancelled' }); return;
    }
    state.set(step.id, 'running');
    options?.stream?.onAgentStart?.(step.agent, step.id);
    const timeoutMs = boundedInteger(step.timeout_ms, timeoutDefault, 1000, 600000);
    const maxRetries = boundedInteger(step.retries, retries, 0, 5);
    let finalResult: AgentExecutionResult | undefined;
    let attemptsMade = 0;
    let worktreePath: string | undefined;
    try {
      if (options?.repositoryPath) {
        if (!options.runId) throw new Error('runId is required when repositoryPath is provided');
        const worktree = await createIsolatedWorktree(
          options.repositoryPath,
          `${options.runId}_${safeStepSuffix(step.id)}`,
          options.baseRef || 'HEAD'
        );
        worktreePath = worktree.worktreePath;
      }
      const variables = { ...inputs, ...outputs, ...Object.fromEntries(stepOutput) };
      const task = replaceVariables(step.task, variables);
      const context = {
        ...(options?.inputs ? { workflowInputs: options.inputs } : {}),
        ...(options?.outputs ? { priorOutputs: options.outputs } : {}),
        stepId: step.id, workflowName, runId: options?.runId,
        repositoryPath: options?.repositoryPath, baseRef: options?.baseRef || 'HEAD',
        worktreePath,
        instructions: worktreePath
          ? 'This step has an isolated local Git worktree. Use worktreePath as the only workspace for this step; do not modify repositoryPath directly. Return a concise summary of changes made or exact files/patches required.'
          : undefined,
      };
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        attemptsMade = attempt + 1;
        throwIfAborted(options?.signal);
        await checkpoint(options, { stepId: step.id, agentId: step.agent, status: 'running', attempt: attempt + 1, worktreePath });
        const attemptController = new AbortController();
        const onWorkflowAbort = () => attemptController.abort();
        options?.signal?.addEventListener('abort', onWorkflowAbort, { once: true });
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        try {
          const timeout = new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(() => { attemptController.abort(); reject(new Error(`Step timed out after ${timeoutMs}ms`)); }, timeoutMs);
          });
          finalResult = await Promise.race([
            executeAgent(step.agent, task, { sessionId: options?.sessionId, signal: attemptController.signal, timeoutMs, context }),
            timeout,
          ]);
        } catch (error) {
          finalResult = { success: false, output: '', duration: 0, error: error instanceof Error ? error.message : 'Step failed' };
        } finally {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          options?.signal?.removeEventListener('abort', onWorkflowAbort);
        }
        if (finalResult.success || options?.signal?.aborted || attempt === maxRetries) break;
        await new Promise(resolve => setTimeout(resolve, Math.min(250 * (2 ** attempt), 2000)));
      }
    } catch (error) {
      finalResult = { success: false, output: '', duration: 0, error: error instanceof Error ? error.message : 'Step failed' };
    }
    if (options?.signal?.aborted) {
      state.set(step.id, 'skipped'); failureReasons.set(step.id, 'Workflow cancelled');
      await checkpoint(options, { stepId: step.id, agentId: step.agent, status: 'skipped', error: 'Workflow cancelled', worktreePath }); return;
    }
    const result = finalResult || { success: false, output: '', duration: 0, error: 'Step failed' };
    results.push({ agentId: step.agent, stepId: step.id, output: result.output, duration: result.duration, success: result.success, error: result.error });
    if (result.success) {
      state.set(step.id, 'completed'); stepOutput.set(step.id, result.output);
      outputs[step.id] = result.output; outputs[`step_${step.id}`] = result.output;
      if (step.output_var) outputs[step.output_var] = result.output;
      options?.stream?.onAgentComplete?.(step.agent, result.output);
      await checkpoint(options, { stepId: step.id, agentId: step.agent, status: 'completed', attempt: attemptsMade, output: result.output, worktreePath });
    } else {
      state.set(step.id, 'failed'); failureReasons.set(step.id, result.error || 'Step failed');
      options?.stream?.onAgentFailed?.(step.agent, result.error || 'Step failed');
      await checkpoint(options, { stepId: step.id, agentId: step.agent, status: 'failed', error: result.error || 'Step failed', worktreePath });
    }
  };

  let completedCount = 0;
  while (completedCount < steps.length) {
    if (options?.signal?.aborted) {
      for (const step of steps) if (state.get(step.id) === 'pending') {
        state.set(step.id, 'skipped');
        await checkpoint(options, { stepId: step.id, agentId: step.agent, status: 'skipped', error: 'Workflow cancelled' });
      }
      break;
    }
    let changed = false;
    for (const step of steps) if (state.get(step.id) === 'pending' &&
      (step.depends_on || []).some(dep => state.get(dep) === 'failed' || state.get(dep) === 'skipped')) {
      state.set(step.id, 'skipped'); failureReasons.set(step.id, 'Dependency failed or was skipped'); changed = true;
      await checkpoint(options, { stepId: step.id, agentId: step.agent, status: 'skipped', error: 'Dependency failed or was skipped' });
    }
    const ready = steps.filter(step => state.get(step.id) === 'pending' && (step.depends_on || []).every(dep => state.get(dep) === 'completed'));
    if (!ready.length && !changed && !steps.some(step => state.get(step.id) === 'running')) {
      for (const step of steps.filter(s => state.get(s.id) === 'pending')) {
        state.set(step.id, 'failed'); failureReasons.set(step.id, 'Dependency cycle detected');
        await checkpoint(options, { stepId: step.id, agentId: step.agent, status: 'failed', error: 'Dependency cycle detected' });
      }
      break;
    }
    if (ready.length) {
      await Promise.all(ready.slice(0, concurrency).map(runStep));
      completedCount = [...state.values()].filter(v => v === 'completed' || v === 'failed' || v === 'skipped').length;
      options?.stream?.onProgress?.(completedCount, steps.length);
    } else completedCount = [...state.values()].filter(v => v === 'completed' || v === 'failed' || v === 'skipped').length;
  }
  const cancelled = options?.signal?.aborted;
  const failures = [...state].filter(([, v]) => v === 'failed' || v === 'skipped').map(([id]) => id);
  const succeeded = [...state.values()].filter(v => v === 'completed').length;
  return {
    workflowId: workflowName, status: cancelled ? 'cancelled' : failures.length === 0 ? 'completed' : succeeded > 0 ? 'partial' : 'failed',
    outputs,
    agentResults: results.sort((a, b) => steps.findIndex(s => s.id === a.stepId) - steps.findIndex(s => s.id === b.stepId)),
    totalDuration: Date.now() - startTime,
    error: failures.length ? failures.map(id => `${id}: ${failureReasons.get(id) || 'failed'}`).join('; ') : undefined,
  };
}
function replaceVariables(template: string, variables: Record<string, unknown>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    result = result.split(`{{${key}}}`).join(stringValue ?? '');
  }
  return result;
}
export const engine = { executeAgent, executeWorkflow, listAgents };
export default engine;
