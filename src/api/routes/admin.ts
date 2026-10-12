import { Router, Request, Response } from 'express';
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db/client.js';

const router = Router();

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const agentsDir = process.env.AGENTS_DIR || './agents';
    const skillsDir = process.env.SKILLS_DIR || './skills';
    const workflowsDir = process.env.WORKFLOWS_DIR || './workflows';
    
    const [agentsFiles, skillsFiles, workflowsFiles, sessionResult, channelResult] = await Promise.all([
      readdir(agentsDir).catch(() => []),
      readdir(skillsDir).catch(() => []),
      readdir(workflowsDir).catch(() => []),
      db.query<{ count: string }>('SELECT COUNT(*) as count FROM sessions').catch(() => ({ rows: [{ count: 0 }] })),
      db.query<{ count: string }>('SELECT COUNT(*) as count FROM channels').catch(() => ({ rows: [{ count: 0 }] })),
    ]);
    
    const agents = agentsFiles.filter(f => f.endsWith('.md')).length;
    const skills = skillsFiles.filter(f => f.endsWith('.md')).length;
    const workflows = workflowsFiles.filter(f => f.endsWith('.yaml') || f.endsWith('.yml')).length;
    const sessions = Number(sessionResult.rows[0]?.count || 0);
    const channels = Number(channelResult.rows[0]?.count || 0);
    
    res.json({
      agents: { count: agents, path: agentsDir },
      skills: { count: skills, path: skillsDir },
      workflows: { count: workflows, path: workflowsDir },
      sessions: { count: sessions },
      channels: { count: channels },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

router.post('/agents', async (req: Request, res: Response) => {
  try {
    const { name, division, description, capabilities } = req.body;
    
    if (!name || !division) {
      res.status(400).json({ error: 'Name and division are required' });
      return;
    }
    
    const agentsDir = process.env.AGENTS_DIR || './agents';
    const divisionPath = join(agentsDir, division);
    
    if (!existsSync(divisionPath)) {
      await mkdir(divisionPath, { recursive: true });
    }
    
    const fileName = name.toLowerCase().replace(/\s+/g, '-') + '.md';
    const content = `# ${name}

${description || `${name} agent`}

## Role
${division}

## Capabilities
${(capabilities || []).map((c: string) => `- ${c}`).join('\n')}

## Tools
- Task execution
- Context awareness
- Memory persistence
`;

    await writeFile(join(divisionPath, fileName), content);
    
    res.json({ success: true, agent: { name, division, file: fileName } });
  } catch (error) {
    res.status(400).json({ error: 'Failed to create agent', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/skills', async (req: Request, res: Response) => {
  try {
    const { name, description, usage, workflow } = req.body;
    
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }
    
    const skillsDir = process.env.SKILLS_DIR || './skills';
    const fileName = name.toLowerCase().replace(/\s+/g, '-') + '.md';
    
    const content = `# ${name}

${description || `${name} skill`}

## Usage

\`\`\`
/${name.toLowerCase()} ${usage || ''}
\`\`\`

## Workflow

${workflow || 'Execute the requested task using available agents and tools.'}

## Tools Used

- Code executor
- File manager
- Web search
`;

    await writeFile(join(skillsDir, fileName), content);
    
    res.json({ success: true, skill: { name, file: fileName } });
  } catch (error) {
    res.status(400).json({ error: 'Failed to create skill', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;