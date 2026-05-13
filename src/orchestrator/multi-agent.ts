import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { parse } from 'yaml';

export interface AgentRole {
  id: string;
  name: string;
  specialty: string;
  capabilities: string[];
  content: string;
  division: string;
}

export interface WorkflowStep {
  id: string;
  role: string;
  task: string;
  output?: string;
  depends_on?: string[];
}

export interface WorkflowDefinition {
  name: string;
  description?: string;
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

export interface StepResult {
  stepId: string;
  success: boolean;
  output: string;
  duration: number;
  error?: string;
}

export async function loadRoles(agentsDir: string): Promise<AgentRole[]> {
  const roles: AgentRole[] = [];
  const divisions = ['engineering', 'marketing', 'sales', 'product', 'testing', 'support', 'design', 'operations'];

  for (const division of divisions) {
    try {
      const divisionPath = join(agentsDir, division);
      const files = await readdir(divisionPath);

      for (const file of files) {
        if (file.endsWith('.md')) {
          const id = file.replace('.md', '');
          const content = await readFile(join(divisionPath, file), 'utf-8');
          const nameMatch = content.match(/^#\s+(.+)/m);
          const specialtyMatch = content.match(/##\s+Your Specialties?\n([\s\S]+?)##/);

          roles.push({
            id,
            name: nameMatch ? nameMatch[1] : id,
            specialty: specialtyMatch ? specialtyMatch[1].trim() : '',
            capabilities: [],
            content,
            division,
          });
        }
      }
    } catch {
      // Division doesn't exist
    }
  }

  return roles;
}

export async function findRolesForTask(task: string, roles: AgentRole[]): Promise<AgentRole[]> {
  const taskLower = task.toLowerCase();
  const matched: { role: AgentRole; score: number }[] = [];

  for (const role of roles) {
    let score = 0;
    const roleText = `${role.name} ${role.specialty} ${role.content}`.toLowerCase();

    // Direct keyword matches
    const keywords: Record<string, number> = {
      'code': 10, 'bug': 10, 'test': 10, 'review': 10,
      'design': 9, 'ui': 9, 'ux': 9, 'visual': 9,
      'marketing': 8, 'growth': 8, 'seo': 8, 'content': 8,
      'sales': 8, 'outbound': 8, 'pipeline': 8,
      'product': 7, 'roadmap': 7, 'prd': 7,
      'security': 10, 'audit': 10, 'vulnerability': 10,
      'deploy': 9, 'devops': 9, 'infrastructure': 9,
      'data': 6, 'analytics': 6, 'database': 6,
    };

    for (const [keyword, weight] of Object.entries(keywords)) {
      if (taskLower.includes(keyword) && roleText.includes(keyword)) {
        score += weight;
      }
    }

    // Division-specific scoring
    if (taskLower.includes('frontend') && role.division === 'engineering') score += 5;
    if (taskLower.includes('backend') && role.division === 'engineering') score += 5;
    if (taskLower.includes('mobile') && role.division === 'engineering') score += 5;

    if (score > 0) {
      matched.push({ role, score });
    }
  }

  // Sort by score and return top matches
  matched.sort((a, b) => b.score - a.score);
  return matched.slice(0, 5).map(m => m.role);
}

export async function loadWorkflow(name: string, workflowsDir: string): Promise<WorkflowDefinition | null> {
  try {
    const content = await readFile(join(workflowsDir, `${name}.yaml`), 'utf-8');
    return parse(content) as WorkflowDefinition;
  } catch {
    try {
      const content = await readFile(join(workflowsDir, name), 'utf-8');
      return parse(content) as WorkflowDefinition;
    } catch {
      return null;
    }
  }
}

export function buildDAG(steps: WorkflowStep[]): Map<string, string[]> {
  const dag = new Map<string, string[]>();

  for (const step of steps) {
    dag.set(step.id, step.depends_on || []);
  }

  return dag;
}

export function getExecutionOrder(steps: WorkflowStep[]): string[][] {
  const dag = buildDAG(steps);
  const inDegree = new Map<string, number>();
  const result: string[][] = [];

  for (const step of steps) {
    inDegree.set(step.id, step.depends_on?.length || 0);
  }

  while (result.flat().length < steps.length) {
    const currentBatch: string[] = [];

    for (const step of steps) {
      if (result.flat().includes(step.id)) continue;

      const deps = step.depends_on || [];
      const allDepsDone = deps.every(d => result.flat().includes(d));

      if (allDepsDone) {
        currentBatch.push(step.id);
      }
    }

    if (currentBatch.length === 0) break;
    result.push(currentBatch);
  }

  return result;
}

export async function saveOutput(dir: string, stepId: string, content: string): Promise<void> {
  await writeFile(join(dir, `${stepId}.md`), content);
}

export const roles = {
  loadRoles,
  findRolesForTask,
  loadWorkflow,
  buildDAG,
  getExecutionOrder,
  saveOutput,
};

export default roles;