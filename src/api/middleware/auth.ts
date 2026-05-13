import crypto from 'crypto';

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
  return crypto.timingSafeEqual(Buffer.from(providedHash), Buffer.from(storedHash));
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `agency_${crypto.randomBytes(32).toString('hex')}`;
  const prefix = key.substring(0, 20);
  const hash = hashApiKey(key);
  return { key, prefix, hash };
}

export function extractApiKey(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  
  if (authHeader.startsWith('x-api-key ')) {
    return authHeader.substring(10).trim();
  }
  
  return authHeader.trim();
}

export function parseBasicAuth(authHeader: string): { user: string; pass: string } | null {
  if (!authHeader.startsWith('Basic ')) return null;
  
  try {
    const decoded = Buffer.from(authHeader.substring(6), 'base64').toString();
    const [user, pass] = decoded.split(':');
    return { user, pass };
  } catch {
    return null;
  }
}

export function isValidApiKeyFormat(key: string): boolean {
  return key.length >= 32 && /^[a-zA-Z0-9_-]+$/.test(key);
}

export const DEFAULT_API_KEY = process.env.API_KEY || 'agency-dev-key-change-in-production';

export function validateRequestAuth(
  authHeader: string | undefined,
  allowedKeys: Map<string, { id: string; permissions: string[] }>
): AuthResult {
  const key = extractApiKey(authHeader);
  
  if (!key) {
    return { valid: false, error: 'Missing API key' };
  }
  
  if (key === DEFAULT_API_KEY) {
    return { valid: true, userId: 'default', apiKeyId: 'default' };
  }
  
  const keyInfo = allowedKeys.get(key);
  if (keyInfo) {
    return { valid: true, userId: keyInfo.id, apiKeyId: keyInfo.id };
  }
  
  return { valid: false, error: 'Invalid API key' };
}