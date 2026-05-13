import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { classifyTask, getModelForTask } from '../../orchestrator/llm.js';
import { llmManager } from '../../orchestrator/llm-manager.js';
import { executeAgent } from '../../orchestrator/engine.js';
import { sessionStore } from '../../memory/session.js';
import { createSSEStream } from '../../streaming/sse.js';
import { router as agentRouter } from '../../orchestrator/router.js';

const router = Router();

const ComposeSchema = z.object({
  prompt: z.string().min(1),
  sessionId: z.string().uuid().optional(),
  provider: z.string().optional(),
  stream: z.boolean().default(false),
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { prompt, sessionId, provider, stream } = ComposeSchema.parse(req.body);
    
    if (stream) {
      const sse = createSSEStream(res);
      
      sse.sendEvent('start', { prompt });
      
      try {
        const taskType = classifyTask(prompt);
        const model = provider || getModelForTask(taskType);
        
        sse.sendEvent('routing', { taskType, model });
        
        const routingResult = await agentRouter.routeTask(prompt, taskType);
        
        sse.agentStart(routingResult.agentId);
        
        const result = await executeAgent(
          routingResult.agentId,
          prompt,
          { sessionId, stream: sse }
        );
        
        if (result.success) {
          sse.agentComplete(routingResult.agentId, result.output);
          sse.workflowComplete({ output: result.output });
        } else {
          sse.agentFailed(routingResult.agentId, result.error || 'Unknown error');
        }
        
        if (sessionId) {
          await sessionStore.updateActivity(sessionId);
        }
        
        sse.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Execution failed';
        sse.error(errorMessage);
        sse.close();
      }
      
      return;
    }

    const taskType = classifyTask(prompt);
    const model = provider || getModelForTask(taskType);
    
    const routingResult = await agentRouter.routeTask(prompt, taskType);
    
    const result = await executeAgent(routingResult.agentId, prompt, { sessionId });
    
    if (sessionId) {
      await sessionStore.updateActivity(sessionId);
    }
    
    res.json({
      success: true,
      agentId: routingResult.agentId,
      taskType,
      model,
      output: result.output,
      usage: result.usage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Compose failed';
    res.status(400).json({ error: 'Compose failed', message });
  }
});

router.get('/', (req: Request, res: Response) => {
  res.json({
    endpoint: 'POST /api/compose',
    description: 'Natural language task routing and execution',
    body: {
      prompt: 'string (required) - Task description',
      sessionId: 'uuid (optional) - Session to update',
      provider: 'string (optional) - LLM provider override',
      stream: 'boolean (optional) - Enable SSE streaming',
    },
    examples: [
      {
        prompt: 'Build a REST API with authentication',
        stream: false,
      },
      {
        prompt: 'Review this code for security issues',
        stream: true,
      },
    ],
  });
});

export default router;