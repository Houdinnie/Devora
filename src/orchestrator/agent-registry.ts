import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

export interface AgentInfo {
  id: string;
  name: string;
  division: string;
  description: string;
  capabilities: string[];
  path: string;
}

export async function listAgents(): Promise<AgentInfo[]> {
  const agentsDir = process.env.AGENTS_DIR || './agents';
  const agents: AgentInfo[] = [];
  
  const divisions = ['engineering', 'webdesign', 'seo', 'operations', 'marketing', 'sales', 'product', 'hr', 'finance', 'strategy', 'testing', 'security', 'design', 'specialized'];
  
  for (const division of divisions) {
    try {
      const divisionPath = join(agentsDir, division);
      const files = await readdir(divisionPath);
      
      for (const file of files) {
        if (file.endsWith('.md')) {
          const id = file.replace('.md', '');
          const content = await readFile(join(divisionPath, file), 'utf-8');
          
          const descriptionMatch = content.match(/^#\s+(.+)/m);
          const description = descriptionMatch 
            ? descriptionMatch[1] 
            : `${id.replace(/-/g, ' ')} agent`;
          
          const capabilities: string[] = [];
          const capsMatch = content.match(/\*\*Capabilities\*\*/i);
          if (capsMatch) {
            const capsSection = content.substring(
              content.indexOf('**Capabilities**'),
              content.indexOf('##', content.indexOf('**Capabilities**')) || content.length
            );
            const bulletMatches = capsSection.match(/-\s+([^-]+)/g);
            if (bulletMatches) {
              capabilities.push(...bulletMatches.map(m => m.replace(/^-\s+/, '').trim()));
            }
          }
          
          agents.push({
            id,
            name: id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            division,
            description,
            capabilities,
            path: join(divisionPath, file),
          });
        }
      }
    } catch (error) {
      console.error(`Failed to list agents in ${division}:`, error);
    }
  }
  
  return agents;
}

export async function getAgentContent(agentId: string): Promise<string | null> {
  const agentsDir = process.env.AGENTS_DIR || './agents';
  const divisions = ['engineering', 'webdesign', 'seo', 'operations', 'marketing', 'sales', 'product', 'hr', 'finance', 'strategy', 'testing', 'security', 'design', 'specialized'];
  
  for (const division of divisions) {
    try {
      const filePath = join(agentsDir, division, `${agentId}.md`);
      return await readFile(filePath, 'utf-8');
    } catch {
      continue;
    }
  }
  
  return null;
}

export function matchAgentToTask(task: string, agents: AgentInfo[]): AgentInfo | null {
  const lowerTask = task.toLowerCase();
  
  const keywordMap: Record<string, string[]> = {
    'frontend-developer': ['frontend', 'react', 'vue', 'angular', 'css', 'html', 'ui', 'component'],
    'backend-architect': ['backend', 'api', 'server', 'database', 'rest', 'graphql'],
    'devops-engineer': ['docker', 'kubernetes', 'ci/cd', 'deployment', 'infrastructure', 'aws'],
    'security-engineer': ['security', 'vulnerability', 'audit', 'owasp', 'penetration'],
    'ml-engineer': ['machine learning', 'ml', 'ai', 'model', 'training', 'inference'],
    'qa-expert': ['test', 'qa', 'quality', 'automation', 'selenium'],
    'database-optimizer': ['database', 'sql', 'query', 'optimization', 'index', 'postgresql'],
    'code-reviewer': ['review', 'refactor', 'clean code', 'lint'],
    'incident-commander': ['incident', 'debug', 'error', 'crash', 'production'],
  };
  
  for (const [agentId, keywords] of Object.entries(keywordMap)) {
    if (keywords.some(kw => lowerTask.includes(kw))) {
      const agent = agents.find(a => a.id === agentId);
      if (agent) return agent;
    }
  }
  
  return agents.find(a => a.id === 'frontend-developer') || agents[0] || null;
}

export async function seedAgentRegistry(): Promise<void> {
  const agents = await listAgents();
  
  console.log(`Loaded ${agents.length} agents:`);
  for (const agent of agents) {
    console.log(`  - [${agent.division}] ${agent.id}: ${agent.description.substring(0, 50)}...`);
  }
}

export default {
  listAgents,
  getAgentContent,
  matchAgentToTask,
  seedAgentRegistry,
};