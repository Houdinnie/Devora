import { Request, Response, NextFunction } from 'express';
import { validateRequestAuth } from './auth.js';
import { rateLimit } from '../../memory/cache.js';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        apiKeyId: string;
      };
    }
  }
}

const apiKeyStore = new Map<string, { id: string; permissions: string[] }>();

export function registerApiKey(key: string, id: string, permissions: string[] = ['read', 'execute']): void {
  apiKeyStore.set(key, { id, permissions });
}

export function clearApiKeys(): void {
  apiKeyStore.clear();
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authResult = validateRequestAuth(req.headers.authorization, apiKeyStore);
  
  if (!authResult.valid) {
    res.status(401).json({
      error: 'Unauthorized',
      message: authResult.error || 'Invalid or missing API key',
    });
    return;
  }
  
  req.auth = {
    userId: authResult.userId!,
    apiKeyId: authResult.apiKeyId!,
  };
  
  next();
}

export function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authResult = validateRequestAuth(req.headers.authorization, apiKeyStore);
  
  if (authResult.valid) {
    req.auth = {
      userId: authResult.userId!,
      apiKeyId: authResult.apiKeyId!,
    };
  }
  
  next();
}

export function rateLimitMiddleware(
  maxRequests: number = 100,
  windowSeconds: number = 60
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.auth?.userId || req.ip || 'anonymous';
    const endpoint = req.path;
    const key = `ratelimit:${userId}:${endpoint}`;
    
    try {
      const result = await rateLimit(key, maxRequests, windowSeconds);
      
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      res.setHeader('X-RateLimit-Reset', new Date(result.resetAt).toISOString());
      
      if (!result.allowed) {
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        });
        return;
      }
      
      next();
    } catch (error) {
      console.error('Rate limit error:', error);
      next();
    }
  };
}

export function permissionMiddleware(requiredPermission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const keyInfo = apiKeyStore.get(req.auth.apiKeyId);
    const permissions = keyInfo?.permissions || [];
    
    if (!permissions.includes(requiredPermission) && !permissions.includes('admin')) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Required permission: ${requiredPermission}`,
      });
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