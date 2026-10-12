import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadWorkflow: vi.fn(),
  getAgentContent: vi.fn(),
  complete: vi.fn(),
  stream: vi.fn(),
}));

vi.mock('../src/orchestrator/workflow.js', () => ({ loadWorkflow: mocks.loadWorkflow }));
vi.mock('../src/orchestrator/agent-registry.js', () => ({
  listAgents: vi.fn(),
  getAgentContent: mocks.getAgentContent,
}));
vi.mock('../src/orchestrator/llm-manager.js', () => ({
  llmManager: { complete: mocks.complete, stream: mocks.stream },
}));

import { executeWorkflow } from '../src/orchestrator/engine.js';

describe('workflow DAG scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAgentContent.mockResolvedValue('test agent');
    mocks.complete.mockImplementation(async (prompt: string) => ({
      content: prompt.match(/Task: ([^\n]+)/)?.[1] || 'output',
      model: 'test',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      finish_reason: 'stop',
    }));
  });

  it('runs independent steps concurrently and respects dependencies', async () => {
    let active = 0;
    let maxActive = 0;
    mocks.complete.mockImplementation(async (prompt: string) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 30));
      active -= 1;
      return {
        content: prompt.match(/Task: ([^\n]+)/)?.[1] || 'output',
        model: 'test',
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        finish_reason: 'stop',
      };
    });
    mocks.loadWorkflow.mockResolvedValue({
      name: 'dag-test',
      concurrency: 2,
      steps: [
        { id: 'alpha', agent: 'coder', task: 'alpha task', output_var: 'alpha_out' },
        { id: 'beta', agent: 'coder', task: 'beta task' },
        { id: 'finish', agent: 'coder', task: 'combine {{alpha}} and {{beta}}', depends_on: ['alpha', 'beta'] },
      ],
    });

    const result = await executeWorkflow('dag-test', {});
    expect(result.status).toBe('completed');
    expect(maxActive).toBe(2);
    expect(result.outputs.alpha_out).toContain('alpha task');
    expect(result.outputs.finish).toContain('combine alpha task and beta task');
  });

  it('retries a failed step and then runs its dependent step', async () => {
    let attempts = 0;
    mocks.complete.mockImplementation(async (prompt: string) => {
      if (prompt.includes('Task: fragile task') && attempts++ === 0) throw new Error('temporary provider error');
      return { content: prompt.match(/Task: ([^\n]+)/)?.[1] || 'output', model: 'test', usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, finish_reason: 'stop' };
    });
    mocks.loadWorkflow.mockResolvedValue({
      name: 'retry-test',
      steps: [
        { id: 'fragile', agent: 'coder', task: 'fragile task', retries: 1 },
        { id: 'dependent', agent: 'coder', task: 'got {{fragile}}', depends_on: ['fragile'] },
      ],
    });
    const result = await executeWorkflow('retry-test', {});
    expect(result.status).toBe('completed');
    expect(attempts).toBe(2);
    expect(result.outputs.dependent).toContain('got fragile task');
  });

  it('fails fast on unknown dependencies and dependency cycles', async () => {
    mocks.loadWorkflow.mockResolvedValueOnce({
      name: 'unknown-dep',
      steps: [{ id: 'a', agent: 'coder', task: 'a', depends_on: ['missing'] }],
    });
    const unknown = await executeWorkflow('unknown-dep', {});
    expect(unknown.status).toBe('failed');
    expect(unknown.error).toContain('unknown step missing');

    mocks.loadWorkflow.mockResolvedValueOnce({
      name: 'cycle',
      steps: [
        { id: 'a', agent: 'coder', task: 'a', depends_on: ['b'] },
        { id: 'b', agent: 'coder', task: 'b', depends_on: ['a'] },
      ],
    });
    const cycle = await executeWorkflow('cycle', {});
    expect(cycle.status).toBe('failed');
    expect(cycle.error).toContain('Dependency cycle detected');
  });

  it('honors an already-aborted cancellation signal', async () => {
    mocks.loadWorkflow.mockResolvedValue({ name: 'cancel', steps: [{ id: 'a', agent: 'coder', task: 'a' }] });
    const controller = new AbortController();
    controller.abort();
    const result = await executeWorkflow('cancel', {}, { signal: controller.signal });
    expect(result.status).toBe('cancelled');
    expect(mocks.complete).not.toHaveBeenCalled();
  });
});
