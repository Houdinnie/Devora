import { describe, expect, it } from 'vitest';
import { generateApiKey, hashApiKey, validateRequestAuth, verifyApiKey } from '../src/api/middleware/auth.js';

describe('API key authentication primitives', () => {
  it('accepts only explicitly registered keys', () => {
    const key = 'agency_' + 'a'.repeat(64);
    const allowed = new Map([[key, { id: 'test-key', permissions: ['read'] }]]);
    expect(validateRequestAuth(`Bearer ${key}`, allowed)).toEqual({
      valid: true,
      userId: 'test-key',
      apiKeyId: 'test-key',
    });
    expect(validateRequestAuth('Bearer agency-dev-key-change-in-production', allowed).valid).toBe(false);
    expect(validateRequestAuth(undefined, allowed)).toMatchObject({ valid: false, error: 'Missing API key' });
  });

  it('generates high-entropy keys and verifies their hashes', () => {
    const generated = generateApiKey();
    expect(generated.key).toMatch(/^agency_[a-f0-9]{64}$/);
    expect(generated.prefix).toBe(generated.key.slice(0, 20));
    expect(generated.hash).toBe(hashApiKey(generated.key));
    expect(verifyApiKey(generated.key, generated.hash)).toBe(true);
    expect(verifyApiKey('agency_' + 'b'.repeat(64), generated.hash)).toBe(false);
  });

  it('rejects malformed stored hashes without throwing', () => {
    expect(verifyApiKey('some-key', 'not-a-sha256-hash')).toBe(false);
  });
});
