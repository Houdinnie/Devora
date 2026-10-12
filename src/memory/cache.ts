import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379', {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('Redis connected');
});

export async function cacheGet(key: string): Promise<string | null> {
  return redis.get(key);
}

export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<void> {
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, value);
  } else {
    await redis.set(key, value);
  }
}

export async function cacheDelete(key: string): Promise<void> {
  await redis.del(key);
}

export async function cacheIncrement(key: string): Promise<number> {
  return redis.incr(key);
}

export async function cacheExpire(key: string, ttlSeconds: number): Promise<void> {
  await redis.expire(key, ttlSeconds);
}

export async function cacheTtl(key: string): Promise<number> {
  return redis.ttl(key);
}

export async function cacheKeys(pattern: string): Promise<string[]> {
  return redis.keys(pattern);
}

export async function rateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const current = await cacheIncrement(key);
  
  if (current === 1) {
    await cacheExpire(key, windowSeconds);
  }
  
  const ttl = await cacheTtl(key);
  const resetAt = Date.now() + (ttl * 1000);
  const allowed = current <= maxRequests;
  const remaining = Math.max(0, maxRequests - current);
  
  return { allowed, remaining, resetAt };
}

export async function redisHealthCheck(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  await redis.quit();
}

export const memory = {
  get: cacheGet,
  set: cacheSet,
  delete: cacheDelete,
  increment: cacheIncrement,
  expire: cacheExpire,
  ttl: cacheTtl,
  keys: cacheKeys,
  rateLimit,
  healthCheck: redisHealthCheck,
  close: closeRedis,
};

export default redis;