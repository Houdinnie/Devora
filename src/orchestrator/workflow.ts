import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { parse } from 'yaml';

export interface WorkflowStep {
  id: string;
  agent: string;
  task: string;
  depends_on?: string[];
  output_var?: string;
  condition?: string;
}

export interface WorkflowDefinition {
  name: string;
  description?: string;
  category?: string;
  agents_dir?: string;
  llm?: {
    provider?: string;
    model?: string;
  };
  concurrency?: number;
  inputs?: Array<{
    name: string;
    required?: boolean;
    default?: unknown;
  }>;
  steps: WorkflowStep[];
}

export interface WorkflowInfo {
  name: string;
  description?: string;
  category?: string;
  steps?: WorkflowStep[];
  filePath?: string;
}

export async function listAvailableWorkflows(): Promise<WorkflowInfo[]> {
  const workflowsDir = process.env.WORKFLOWS_DIR || './workflows';
  
  try {
    const files = await readdir(workflowsDir);
    const workflows: WorkflowInfo[] = [];
    
    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        try {
          const content = await readFile(join(workflowsDir, file), 'utf-8');
          const workflow = parse(content) as WorkflowDefinition;
          
          workflows.push({
            name: workflow.name || file.replace(/\.(yaml|yml)$/, ''),
            description: workflow.description,
            category: workflow.category,
            steps: workflow.steps,
            filePath: join(workflowsDir, file),
          });
        } catch (e) {
          console.error(`Failed to parse workflow ${file}:`, e);
        }
      }
    }
    
    return workflows;
  } catch (error) {
    console.error('Failed to list workflows:', error);
    return [];
  }
}

export async function loadWorkflow(name: string): Promise<WorkflowDefinition | null> {
  const workflowsDir = process.env.WORKFLOWS_DIR || './workflows';
  
  try {
    const content = await readFile(
      join(workflowsDir, `${name}.yaml`),
      'utf-8'
    );
    return parse(content) as WorkflowDefinition;
  } catch (error) {
    try {
      const content = await readFile(
        join(workflowsDir, name),
        'utf-8'
      );
      return parse(content) as WorkflowDefinition;
    } catch {
      return null;
    }
  }
}

export interface WorkflowContext {
  inputs: Record<string, unknown>;
  outputs: Record<string, string>;
  sessionId?: string;
  stream?: {
    onAgentStart?: (agentId: string, step: string) => void;
    onAgentComplete?: (agentId: string, output: string) => void;
    onAgentFailed?: (agentId: string, error: string) => void;
    onProgress?: (current: number, total: number) => void;
  };
}

export async function buildDAG(steps: WorkflowStep[]): Promise<Map<string, string[]>> {
  const dag = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  
  for (const step of steps) {
    dag.set(step.id, []);
    inDegree.set(step.id, 0);
  }
  
  for (const step of steps) {
    if (step.depends_on) {
      for (const dep of step.depends_on) {
        const children = dag.get(dep);
        if (children) {
          children.push(step.id);
        }
        inDegree.set(step.id, (inDegree.get(step.id) || 0) + 1);
      }
    }
  }
  
  return dag;
}

export async function getExecutionOrder(
  steps: WorkflowStep[]
): Promise<{ ready: string[]; blocked: string[] }> {
  const dag = await buildDAG(steps);
  const inDegree = new Map<string, number>();
  const completed = new Set<string>();
  
  for (const step of steps) {
    inDegree.set(step.id, step.depends_on?.length || 0);
  }
  
  const ready: string[] = [];
  const blocked: string[] = [];
  
  while (ready.length + blocked.length < steps.length) {
    let found = false;
    
    for (const step of steps) {
      if (completed.has(step.id)) continue;
      if (ready.includes(step.id)) continue;
      if (blocked.includes(step.id)) continue;
      
      const depsComplete = step.depends_on?.every(d => completed.has(d)) ?? true;
      
      if (depsComplete) {
        ready.push(step.id);
        completed.add(step.id);
        found = true;
      }
    }
    
    if (!found) {
      for (const step of steps) {
        if (!completed.has(step.id) && !ready.includes(step.id)) {
          blocked.push(step.id);
        }
      }
      break;
    }
  }
  
  return { ready, blocked };
}