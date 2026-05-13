import { Router, Request, Response } from 'express';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';
import { executeAgent } from '../../orchestrator/engine.js';
import { listAgents } from '../../orchestrator/agent-registry.js';
import { sessionStore } from '../../memory/session.js';
import { db } from '../../db/client.js';
import { createSSEStream } from '../../streaming/sse.js';

const router = Router();

const ExecuteAgentSchema = z.object({
  task: z.string().min(1),
  context: z.record(z.unknown()).optional(),
  sessionId: z.string().uuid().optional(),
  stream: z.boolean().default(false),
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const agents = await listAgents();
    
    res.json({
      count: agents.length,
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        division: a.division,
        description: a.description,
        capabilities: a.capabilities,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list agents' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agentsDir = process.env.AGENTS_DIR || './agents';
    
    const divisions = ['engineering', 'webdesign', 'seo', 'operations'];
    let agentContent: string | null = null;
    let agentPath: string | null = null;
    
    for (const division of divisions) {
      try {
        const filePath = join(agentsDir, division, `${id}.md`);
        agentContent = await readFile(filePath, 'utf-8');
        agentPath = filePath;
        break;
      } catch {
        continue;
      }
    }
    
    if (!agentContent) {
      res.status(404).json({ error: 'Agent not found', id });
      return;
    }
    
    res.json({
      id,
      content: agentContent,
      path: agentPath,
    });
  } catch (error) {
    res.status(404).json({ error: 'Agent not found', id: req.params.id });
  }
});

router.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { task, context, sessionId, stream } = ExecuteAgentSchema.parse(req.body);
    
    let session = sessionId ? await sessionStore.get(sessionId) : null;
    
    if (!session) {
      session = await sessionStore.create({
        name: `Agent: ${id}`,
        metadata: { agentId: id },
      });
    }
    
    if (stream) {
      const sse = createSSEStream(res);
      
      sse.agentStart(id);
      
      try {
        const result = await executeAgent(id, task, {
          sessionId: session.id,
          context,
          stream: sse,
        });
        
        if (result.success) {
          sse.agentComplete(id, result.output);
        } else {
          sse.agentFailed(id, result.error || 'Execution failed');
        }
        
        sse.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Execution failed';
        sse.error(errorMessage);
        sse.close();
      }
      
      return;
    }
    
    const result = await executeAgent(id, task, {
      sessionId: session.id,
      context,
    });
    
    await db.query(
      `INSERT INTO agent_outputs (session_id, agent_id, output_text, input_task, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        session.id,
        id,
        result.output,
        task,
        JSON.stringify(context || {}),
      ]
    );
    
    await sessionStore.updateActivity(session.id);
    
    res.json({
      success: result.success,
      agentId: id,
      output: result.output,
      duration: result.duration,
      usage: result.usage,
      error: result.error,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent execution failed';
    res.status(400).json({ error: 'Agent execution failed', message });
  }
});

export default router;