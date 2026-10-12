import { z } from 'zod';

export const LLMConfigSchema = z.object({
  model: z.string(),
  temperature: z.number().min(0).max(2).default(0.7),
  max_tokens: z.number().min(1).max(128000).default(4096),
  top_p: z.number().min(0).max(1).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  stream: z.boolean().default(false),
  timeout_ms: z.number().int().min(1000).max(600000).optional(),
});

export type LLMConfig = z.infer<typeof LLMConfigSchema>;

export interface LLMResponse {
  content: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finish_reason: string;
}

export interface LLMStreamChunk {
  delta: string;
  model: string;
  done: boolean;
}

export interface LLMProvider {
  name: string;
  models: string[];
  supportsStreaming: boolean;
  isAvailable(): Promise<boolean>;
  complete(prompt: string, config?: Partial<LLMConfig>): Promise<LLMResponse>;
  stream?(prompt: string, config?: Partial<LLMConfig>): AsyncGenerator<LLMStreamChunk>;
}

export interface AgentExecutionContext {
  agentId: string;
  task: string;
  sessionId?: string;
  previousOutputs?: Record<string, string>;
  config?: Partial<LLMConfig>;
}

export interface WorkflowStep {
  id: string;
  agentId: string;
  task: string;
  dependsOn?: string[];
  outputVar?: string;
}

export interface WorkflowResult {
  workflowId: string;
  status: 'completed' | 'failed' | 'partial';
  outputs: Record<string, string>;
  agentResults: Array<{
    agentId: string;
    stepId: string;
    output: string;
    duration: number;
    success: boolean;
    error?: string;
  }>;
  totalDuration: number;
  error?: string;
}

export const ModelRouting = {
  codeGeneration: 'qwen-coder-14b',
  fastTasks: 'phi4-mini',
  complexReasoning: 'claude-haiku',
  mlTasks: 'hf-llama-8b',
  default: 'qwen-coder-14b',
} as const;

export function getModelForTask(taskType: keyof typeof ModelRouting): string {
  return ModelRouting[taskType] || ModelRouting.default;
}

export function classifyTask(task: string): keyof typeof ModelRouting {
  const lowerTask = task.toLowerCase();
  
  if (lowerTask.includes('code') || lowerTask.includes('function') || 
      lowerTask.includes('implement') || lowerTask.includes('write')) {
    return 'codeGeneration';
  }
  
  if (lowerTask.includes('analyze') || lowerTask.includes('reason') ||
      lowerTask.includes('complex') || lowerTask.includes('architect')) {
    return 'complexReasoning';
  }
  
  if (lowerTask.includes('ml') || lowerTask.includes('model') ||
      lowerTask.includes('train') || lowerTask.includes('machine learning')) {
    return 'mlTasks';
  }
  
  return 'fastTasks';
}