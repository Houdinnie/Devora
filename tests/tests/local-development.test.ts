import { describe, expect, it } from 'vitest';
import { createMemoryLimiter, localDevelopmentEnabled, validateLocalDevelopment } from '../src/api/local-development.js';

describe('explicit local development boundaries', () => {
  it('requires the flag and an explicit development environment', () => {
    expect(localDevelopmentEnabled({})).toBe(false);
    expect(localDevelopmentEnabled({ DEVORA_LOCAL_DEV: 'true' })).toBe(false);
    expect(localDevelopmentEnabled({ NODE_ENV: 'production', DEVORA_LOCAL_DEV: 'true' })).toBe(false);
    expect(localDevelopmentEnabled({ NODE_ENV: 'development', DEVORA_LOCAL_DEV: 'true' })).toBe(true);
  });
  it('blocks the Redis-free flag in production or unspecified mode', () => {
    expect(() => validateLocalDevelopment({ NODE_ENV: 'production', DEVORA_LOCAL_DEV: 'true' })).toThrow();
    expect(() => validateLocalDevelopment({ DEVORA_LOCAL_DEV: 'true' })).toThrow();
    expect(() => validateLocalDevelopment({ NODE_ENV: 'development', DEVORA_LOCAL_DEV: 'true' })).not.toThrow();
  });
  it('limits requests, isolates keys and expires windows', () => {
    const limit = createMemoryLimiter();
    expect(limit('a', 2, 60, 0).remaining).toBe(1);
    expect(limit('a', 2, 60, 1).allowed).toBe(true);
    expect(limit('a', 2, 60, 2).allowed).toBe(false);
    expect(limit('b', 2, 60, 3).remaining).toBe(1);
    expect(limit('a', 2, 60, 60000).remaining).toBe(1);
  });
});
