/** The Redis-free limiter is opt-in and only supported on a loopback dev server. */
export function localDevelopmentEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DEVORA_LOCAL_DEV === 'true' && env.NODE_ENV === 'development';
}

export function validateLocalDevelopment(env: NodeJS.ProcessEnv = process.env): void {
  if (env.DEVORA_LOCAL_DEV === 'true' && env.NODE_ENV !== 'development') {
    throw new Error('DEVORA_LOCAL_DEV requires NODE_ENV=development. Production requires Redis.');
  }
}

export function createMemoryLimiter() {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return (key: string, maxRequests: number, windowSeconds: number, now = Date.now()) => {
    // Drop expired entries so catalog paths cannot grow the map indefinitely.
    for (const [id, window] of windows) if (window.resetAt <= now) windows.delete(id);
    const window = windows.get(key) || { count: 0, resetAt: now + windowSeconds * 1000 };
    window.count++;
    windows.set(key, window);
    return { allowed: window.count <= maxRequests, remaining: Math.max(0, maxRequests - window.count), resetAt: window.resetAt };
  };
}
