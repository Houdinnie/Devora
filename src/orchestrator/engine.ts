import { llmManager } from './llm-manager.js';
import { listAgents, getAgentContent } from './agent-registry.js';
import { loadWorkflow, WorkflowContext } from './workflow.js';
import { SSEStream } from '../streaming/sse.js';

export interface AgentExecutionResult {
  success: boolean;
  output: string;
  duration: number;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  error?: string;
}
export interface WorkflowExecutionResult {
  workflowId: string;
  status: 'completed' | 'failed' | 'partial' | 'cancelled';
  outputs: Record<string, string>;
  agentResults: Array<{ agentId: string; stepId: string; output: string; duration: number; success: boolean; error?: string }>;
  totalDuration: number;
  error?: string;
}
export interface WorkflowExecutionOptions extends Partial<WorkflowContext> {
  signal?: AbortSignal;
  concurrency?: number;
  defaultRetries?: number;
  defaultTimeoutMs?: number;
}
const abortError = () => new Error('Workflow cancelled');
function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}
function boundedInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value!))) : fallback;
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
        throwIfAborted(options?.signal);
        fullOutput += chunk.delta;
        options.stream.agentRunning(agentId, undefined, { partial: chunk.delta });
      }
      return { success: true, output: fullOutput, duration: Date.now() - startTime };
    }
    const response = await llmManager.complete(systemPrompt, config, options?.signal);
    throwIfAborted(options?.signal);
    return { success: true, output: response.content, duration: Date.now() - startTime, usage: response.usage };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Execution failed';
    return { success: false, output: '', duration: Date.now() - startTime, error: errorMessage };
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
  const byId = new Map<string, typeof steps[number]>();
  for (const step of steps) {
    if (!step.id || byId.has(step.id)) return empty('failed', `Workflow has a missing or duplicate step id: ${step.id}`);
    byId.set(step.id, step);
  }
  for (const step of steps) {
    for (const dep of step.depends_on || []) {
      if (!byId.has(dep)) return empty('failed', `Step ${step.id} depends on unknown step ${dep}`);
    }
  }
  const concurrency = boundedInteger(options?.concurrency ?? workflow.concurrency, 3, 1, 16);
  const retries = boundedInteger(options?.defaultRetries, 1, 0, 5);
  const timeoutDefault = boundedInteger(options?.defaultTimeoutMs, 120000, 1000, 600000);
  const outputs: Record<string, string> = {};
  const results: WorkflowExecutionResult['agentResults'] = [];
  const state = new Map<string, 'pending' | 'running' | 'completed' | 'failed' | 'skipped'>();
  const stepOutput = new Map<string, string>();
  const failureReasons = new Map<string, string>();
  steps.forEach(step => state.set(step.id, 'pending'));

  const runStep = async (step: typeof steps[number]): Promise<void> => {
    if (options?.signal?.aborted) { state.set(step.id, 'skipped'); failureReasons.set(step.id, 'Workflow cancelled'); return; }
    state.set(step.id, 'running');
    options?.stream?.onAgentStart?.(step.agent, step.id);
    const timeoutMs = boundedInteger(step.timeout_ms, timeoutDefault, 1000, 600000);
    const maxRetries = boundedInteger(step.retries, retries, 0, 5);
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    options?.signal?.addEventListener('abort', onAbort, { once: true });
    let finalResult: AgentExecutionResult | undefined;
    try {
      const task = replaceVariables(step.task, { ...inputs, ...outputs, ...Object.fromEntries([...stepOutput].map(([id, value]) => [id, value])) });
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        throwIfAborted(options?.signal);
        controller.abort(); // Reset is not possible; create a fresh controller for each attempt below.
        const attemptController = new AbortController();
        const onWorkflowAbort = () => attemptController.abort();
        options?.signal?.addEventListener('abort', onWorkflowAbort, { once: true });
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        try {
          const timeout = new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(() => { attemptController.abort(); reject(new Error(`Step timed out after ${timeoutMs}ms`)); }, timeoutMs);
          });
          const execution = executeAgent(step.agent, task, { sessionId: options?.sessionId, signal: attemptController.signal, timeoutMs });
          finalResult = await Promise.race([execution, timeout]);
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
    } finally {
      options?.signal?.removeEventListener('abort', onAbort);
    }
    if (options?.signal?.aborted) {
      state.set(step.id, 'skipped');
      failureReasons.set(step.id, 'Workflow cancelled');
      return;
    }
    const result = finalResult || { success: false, output: '', duration: 0, error: 'Step failed' };
    results.push({ agentId: step.agent, stepId: step.id, output: result.output, duration: result.duration, success: result.success, error: result.error });
    if (result.success) {
      state.set(step.id, 'completed');
      stepOutput.set(step.id, result.output);
      outputs[step.id] = result.output;
      outputs[`step_${step.id}`] = result.output;
      if (step.output_var) outputs[step.output_var] = result.output;
      options?.stream?.onAgentComplete?.(step.agent, result.output);
    } else {
      state.set(step.id, 'failed');
      failureReasons.set(step.id, result.error || 'Step failed');
      options?.stream?.onAgentFailed?.(step.agent, result.error || 'Step failed');
    }
  };

  let completedCount = 0;
  while (completedCount < steps.length) {
    if (options?.signal?.aborted) {
      for (const step of steps) if (state.get(step.id) === 'pending') state.set(step.id, 'skipped');
      break;
    }
    let changed = false;
    for (const step of steps) {
      if (state.get(step.id) !== 'pending') continue;
      const deps = step.depends_on || [];
      if (deps.some(dep => state.get(dep) === 'failed' || state.get(dep) === 'skipped')) {
        state.set(step.id, 'skipped'); failureReasons.set(step.id, 'Dependency failed or was skipped'); changed = true;
      }
    }
    const ready = steps.filter(step => state.get(step.id) === 'pending' && (step.depends_on || []).every(dep => state.get(dep) === 'completed'));
    if (!ready.length && !changed && !steps.some(step => state.get(step.id) === 'running')) {
      const pending = steps.filter(step => state.get(step.id) === 'pending').map(step => step.id);
      for (const id of pending) { state.set(id, 'failed'); failureReasons.set(id, 'Dependency cycle detected'); }
      break;
    }
    if (ready.length) {
      const batch = ready.slice(0, concurrency);
      await Promise.all(batch.map(runStep));
      completedCount = [...state.values()].filter(value => value === 'completed' || value === 'failed' || value === 'skipped').length;
      options?.stream?.onProgress?.(completedCount, steps.length);
    } else {
      completedCount = [...state.values()].filter(value => value === 'completed' || value === 'failed' || value === 'skipped').length;
    }
  }
  const cancelled = options?.signal?.aborted;
  const failures = [...state].filter(([, value]) => value === 'failed' || value === 'skipped').map(([id]) => id);
  const succeeded = [...state.values()].filter(value => value === 'completed').length;
  return {
    workflowId: workflowName,
    status: cancelled ? 'cancelled' : failures.length === 0 ? 'completed' : succeeded > 0 ? 'partial' : 'failed',
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
