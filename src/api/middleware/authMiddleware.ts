import { Request, Response, NextFunction } from 'express';
import { hashApiKey, validateRequestAuth } from './auth.js';
import { rateLimit } from '../../memory/cache.js';
import { db } from '../../db/client.js';

declare global {
  namespace Express {
    interface Request { auth?: { userId: string; apiKeyId: string }; }
  }
}

const apiKeyStore = new Map<string, { id: string; permissions: string[] }>();

export function registerApiKey(key: string, id: string, permissions: string[] = ['read', 'execute']): void {
  if (!key || !id) throw new Error('API key and ID are required');
  apiKeyStore.set(key, { id, permissions: [...new Set(permissions)] });
}
export function clearApiKeys(): void { apiKeyStore.clear(); }

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization || (req.headers['x-api-key'] as string | undefined);
  const inMemory = validateRequestAuth(header, apiKeyStore);
  if (inMemory.valid) {
    req.auth = { userId: inMemory.userId!, apiKeyId: inMemory.apiKeyId! };
    next();
    return;
  }

  const rawKey = header?.startsWith('Bearer ') ? header.slice(7).trim()
    : header?.startsWith('x-api-key ') ? header.slice(10).trim()
    : header?.trim();
  if (!rawKey) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing API key' });
    return;
  }

  try {
    const result = await db.query<{
      id: string; permissions: string[] | string; expires_at: Date | string | null;
    }>(
      `SELECT id, permissions, expires_at FROM api_keys
       WHERE key_hash = $1 AND is_active = true
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [hashApiKey(rawKey)]
    );
    const stored = result.rows[0];
    if (!stored) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired API key' });
      return;
    }

    const permissions = Array.isArray(stored.permissions)
      ? stored.permissions
      : JSON.parse(stored.permissions || '[]') as string[];
    registerApiKey(rawKey, stored.id, permissions);
    void db.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [stored.id]).catch((error) => {
      console.error('Unable to update API key last-used timestamp:', error);
    });
    req.auth = { userId: stored.id, apiKeyId: stored.id };
    next();
  } catch (error) {
    console.error('API key verification failed:', error);
    res.status(503).json({ error: 'Service Unavailable', message: 'Authentication service is temporarily unavailable.' });
  }
}

export function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authResult = validateRequestAuth(req.headers.authorization || (req.headers['x-api-key'] as string | undefined), apiKeyStore);
  if (authResult.valid) req.auth = { userId: authResult.userId!, apiKeyId: authResult.apiKeyId! };
  next();
}

export function rateLimitMiddleware(maxRequests = 100, windowSeconds = 60) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.auth?.userId || req.ip || 'anonymous';
    const key = `ratelimit:${userId}:${req.path}`;
    try {
      const result = await rateLimit(key, maxRequests, windowSeconds);
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(result.remaining));
      res.setHeader('X-RateLimit-Reset', new Date(result.resetAt).toISOString());
      if (!result.allowed) {
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)),
        });
        return;
      }
      next();
    } catch (error) {
      console.error('Rate limiter unavailable:', error);
      res.status(503).json({ error: 'Service Unavailable', message: 'Request protection is temporarily unavailable.' });
    }
  };
}

export function permissionMiddleware(requiredPermission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const keyInfo = [...apiKeyStore.values()].find((entry) => entry.id === req.auth!.apiKeyId);
    const permissions = keyInfo?.permissions || [];
    if (!permissions.includes(requiredPermission) && !permissions.includes('admin')) {
      res.status(403).json({ error: 'Forbidden', message: `Required permission: ${requiredPermission}` });
      return;
    }
    next();
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    return;
  }
  next();
}
