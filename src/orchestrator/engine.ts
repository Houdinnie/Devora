import { readFile } from 'fs/promises';
import { join } from 'path';
import { llmManager } from './llm-manager.js';
import { listAgents, getAgentContent } from './agent-registry.js';
import { loadWorkflow, WorkflowContext, WorkflowDefinition } from './workflow.js';
import { SSEStream } from '../streaming/sse.js';

export interface AgentExecutionResult {
  success: boolean;
  output: string;
  duration: number;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: string;
}

export interface WorkflowExecutionResult {
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

export async function executeAgent(
  agentId: string,
  task: string,
  options?: {
    sessionId?: string;
    context?: Record<string, unknown>;
    stream?: SSEStream;
  }
): Promise<AgentExecutionResult> {
  const startTime = Date.now();
  
  try {
    const agentContent = await getAgentContent(agentId);
    
    if (!agentContent) {
      return {
        success: false,
        output: '',
        duration: Date.now() - startTime,
        error: `Agent not found: ${agentId}`,
      };
    }
    
    const systemPrompt = `${agentContent}

---
Task: ${task}
${options?.context ? `\nContext:\n${JSON.stringify(options.context, null, 2)}` : ''}
`;

    if (options?.stream) {
      options.stream.agentRunning(agentId);
      
      let fullOutput = '';
      
      for await (const chunk of await llmManager.stream(systemPrompt)) {
        fullOutput += chunk.delta;
        options.stream.agentRunning(agentId, undefined, { partial: chunk.delta });
      }
      
      return {
        success: true,
        output: fullOutput,
        duration: Date.now() - startTime,
      };
    }
    
    const response = await llmManager.complete(systemPrompt);
    
    return {
      success: true,
      output: response.content,
      duration: Date.now() - startTime,
      usage: response.usage,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Execution failed';
    
    return {
      success: false,
      output: '',
      duration: Date.now() - startTime,
      error: errorMessage,
    };
  }
}

export async function executeWorkflow(
  workflowName: string,
  inputs: Record<string, unknown>,
  options?: WorkflowContext
): Promise<WorkflowExecutionResult> {
  const startTime = Date.now();
  const workflow = await loadWorkflow(workflowName);
  
  if (!workflow) {
    return {
      workflowId: workflowName,
      status: 'failed',
      outputs: {},
      agentResults: [],
      totalDuration: Date.now() - startTime,
      error: `Workflow not found: ${workflowName}`,
    };
  }
  
  const outputs: Record<string, string> = {};
  const agentResults: WorkflowExecutionResult['agentResults'] = [];
  let failedSteps: string[] = [];
  
  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    
    const depsMet = step.depends_on?.every(d => 
      outputs[d] !== undefined && !failedSteps.includes(d)
    ) ?? true;
    
    if (!depsMet) {
      failedSteps.push(step.id);
      continue;
    }
    
    options?.stream?.onAgentStart?.(step.agent, step.id);
    
    const taskWithContext = replaceVariables(step.task, { ...inputs, ...outputs });
    
    try {
      const result = await executeAgent(step.agent, taskWithContext, {
        sessionId: options?.sessionId,
        stream: options?.stream,
      });
      
      if (result.success) {
        if (step.output_var) {
          outputs[step.output_var] = result.output;
        }
        outputs[`step_${step.id}`] = result.output;
        
        agentResults.push({
          agentId: step.agent,
          stepId: step.id,
          output: result.output,
          duration: result.duration,
          success: true,
        });
      } else {
        failedSteps.push(step.id);
        
        agentResults.push({
          agentId: step.agent,
          stepId: step.id,
          output: '',
          duration: result.duration,
          success: false,
          error: result.error,
        });
      }
      
      options?.stream?.onProgress?.(i + 1, workflow.steps.length);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Step failed';
      failedSteps.push(step.id);
      
      agentResults.push({
        agentId: step.agent,
        stepId: step.id,
        output: '',
        duration: 0,
        success: false,
        error: errorMessage,
      });
      
      options?.stream?.onAgentFailed?.(step.agent, errorMessage);
    }
  }
  
  return {
    workflowId: workflowName,
    status: failedSteps.length === 0 ? 'completed' : 
            failedSteps.length < workflow.steps.length ? 'partial' : 'failed',
    outputs,
    agentResults,
    totalDuration: Date.now() - startTime,
    error: failedSteps.length > 0 ? `Failed steps: ${failedSteps.join(', ')}` : undefined,
  };
}

function replaceVariables(
  template: string,
  variables: Record<string, unknown>
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    result = result.split(placeholder).join(stringValue);
  }
  
  return result;
}

export const engine = {
  executeAgent,
  executeWorkflow,
  listAgents,
};

export default engine;