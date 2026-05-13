import { listAgents, matchAgentToTask, AgentInfo } from './agent-registry.js';
import { classifyTask } from './llm.js';

export interface RoutingResult {
  agentId: string;
  agentName: string;
  division: string;
  reasoning: string;
}

const TASK_TYPE_TO_AGENT: Record<string, string> = {
  codeGeneration: 'frontend-developer',
  fastTasks: 'senior-developer',
  complexReasoning: 'software-architect',
  mlTasks: 'ml-engineer',
};

export async function routeTask(
  task: string,
  taskType?: keyof typeof TASK_TYPE_TO_AGENT
): Promise<RoutingResult> {
  const agents = await listAgents();
  
  if (!taskType) {
    taskType = classifyTask(task) as keyof typeof TASK_TYPE_TO_AGENT;
  }
  
  const defaultAgentId = TASK_TYPE_TO_AGENT[taskType] || 'senior-developer';
  
  const matchedAgent = matchAgentToTask(task, agents);
  
  const selectedAgent = matchedAgent || agents.find(a => a.id === defaultAgentId);
  
  if (!selectedAgent) {
    throw new Error('No suitable agent found for task');
  }
  
  return {
    agentId: selectedAgent.id,
    agentName: selectedAgent.name,
    division: selectedAgent.division,
    reasoning: `Task type: ${taskType}, matched by keywords: ${matchedAgent ? 'keyword match' : 'default fallback'}`,
  };
}

export function getAgentForTaskType(taskType: keyof typeof TASK_TYPE_TO_AGENT): string {
  return TASK_TYPE_TO_AGENT[taskType] || 'senior-developer';
}

export function getAvailableDivisions(): string[] {
  return ['engineering', 'webdesign', 'seo', 'operations'];
}

export function getAgentsByDivision(agents: AgentInfo[], division: string): AgentInfo[] {
  return agents.filter(a => a.division === division);
}

export const router = {
  routeTask,
  getAgentForTaskType,
  getAvailableDivisions,
  getAgentsByDivision,
};

export default router;