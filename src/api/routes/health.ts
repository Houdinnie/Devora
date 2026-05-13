import { Request, Response } from 'express';
import { db } from '../../db/client.js';
import { redisHealthCheck } from '../../memory/cache.js';
import { llmManager } from '../../orchestrator/llm-manager.js';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    api: boolean;
    database: boolean;
    redis: boolean;
    ollama: boolean;
  };
  version: string;
  uptime: number;
}

const startTime = Date.now();

export async function healthCheckHandler(
  req: Request,
  res: Response
): Promise<void> {
  const [dbHealthy, redisHealthy, ollamaHealthy] = await Promise.all([
    db.healthCheck().catch(() => false),
    redisHealthCheck().catch(() => false),
    llmManager.checkHealth().catch(() => false),
  ]);

  const allHealthy = dbHealthy && redisHealthy && ollamaHealthy;
  const anyHealthy = dbHealthy || redisHealthy || ollamaHealthy;

  const status: HealthStatus = {
    status: allHealthy ? 'healthy' : anyHealthy ? 'degraded' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services: {
      api: true,
      database: dbHealthy,
      redis: redisHealthy,
      ollama: ollamaHealthy,
    },
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };

  const httpStatus = allHealthy ? 200 : anyHealthy ? 200 : 503;
  res.status(httpStatus).json(status);
}

export async function readyCheckHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const dbHealthy = await db.healthCheck();
    const ollamaHealthy = await llmManager.checkHealth();
    
    if (dbHealthy && ollamaHealthy) {
      res.status(200).json({ ready: true });
    } else {
      res.status(503).json({ ready: false, reason: 'Services not ready' });
    }
  } catch (error) {
    res.status(503).json({ ready: false, reason: 'Health check failed' });
  }
}

export function livenessHandler(
  req: Request,
  res: Response
): void {
  res.status(200).json({ alive: true, timestamp: new Date().toISOString() });
}