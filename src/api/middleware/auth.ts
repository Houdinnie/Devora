import crypto from 'node:crypto';

export interface AuthResult {
  valid: boolean;
  userId?: string;
  apiKeyId?: string;
  error?: string;
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function verifyApiKey(providedKey: string, storedHash: string): boolean {
  const providedHash = hashApiKey(providedKey);
  if (!/^[a-f0-9]{64}$/i.test(storedHash)) return false;
  return crypto.timingSafeEqual(Buffer.from(providedHash, 'hex'), Buffer.from(storedHash, 'hex'));
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `agency_${crypto.randomBytes(32).toString('hex')}`;
  return { key, prefix: key.substring(0, 20), hash: hashApiKey(key) };
}

export function extractApiKey(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  if (authHeader.startsWith('Bearer ')) return authHeader.substring(7).trim();
  if (authHeader.startsWith('x-api-key ')) return authHeader.substring(10).trim();
  return authHeader.trim() || null;
}

export function isValidApiKeyFormat(key: string): boolean {
  return key.length >= 32 && /^[a-zA-Z0-9_-]+$/.test(key);
}

export function validateRequestAuth(
  authHeader: string | undefined,
  allowedKeys: Map<string, { id: string; permissions: string[] }>
): AuthResult {
  const key = extractApiKey(authHeader);
  if (!key) return { valid: false, error: 'Missing API key' };

  // Keys are looked up only in explicitly registered credentials. There is no
  // built-in development credential or implicit environment-key bypass.
  const keyInfo = allowedKeys.get(key);
  if (!keyInfo) return { valid: false, error: 'Invalid API key' };

  return { valid: true, userId: keyInfo.id, apiKeyId: keyInfo.id };
}
