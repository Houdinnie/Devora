import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { generateApiKey, hashApiKey } from '../middleware/auth.js';
import { db } from '../../db/client.js';
import { requireAuth, permissionMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).default(['read', 'execute']),
  rate_limit: z.number().min(10).max(1000).default(100),
  rate_limit_window: z.number().min(60).max(3600).default(60),
  expires_at: z.string().datetime().optional(),
});

router.get('/', requireAuth, permissionMiddleware('admin'), async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT id, key_prefix, name, description, permissions, rate_limit, rate_limit_window,
              is_active, last_used_at, expires_at, created_at
       FROM api_keys
       ORDER BY created_at DESC`
    );

    res.json({
      count: result.rowCount,
      api_keys: result.rows.map(k => ({
        id: k.id,
        key_prefix: k.key_prefix,
        name: k.name,
        description: k.description,
        permissions: k.permissions,
        rate_limit: k.rate_limit,
        rate_limit_window: k.rate_limit_window,
        is_active: k.is_active,
        last_used_at: k.last_used_at,
        expires_at: k.expires_at,
        created_at: k.created_at,
      })),
    });
  } catch (error) {
    console.error('Failed to list API keys:', error);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

router.post('/', requireAuth, permissionMiddleware('admin'), async (req: Request, res: Response) => {
  try {
    const data = CreateApiKeySchema.parse(req.body);
    const { key, prefix, hash } = generateApiKey();

    const result = await db.query(
      `INSERT INTO api_keys (key_hash, key_prefix, name, description, permissions, rate_limit, rate_limit_window, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, key_prefix, name, description, permissions, rate_limit, rate_limit_window, expires_at, created_at`,
      [hash, prefix, data.name, data.description || null, JSON.stringify(data.permissions), data.rate_limit, data.rate_limit_window, data.expires_at || null]
    );

    const apiKey = result.rows[0];

    res.status(201).json({
      id: apiKey.id,
      key,
      key_prefix: apiKey.key_prefix,
      name: apiKey.name,
      description: apiKey.description,
      permissions: data.permissions,
      rate_limit: apiKey.rate_limit,
      rate_limit_window: apiKey.rate_limit_window,
      expires_at: apiKey.expires_at,
      created_at: apiKey.created_at,
      message: 'Store this key securely. It will not be shown again.',
    });
  } catch (error) {
    console.error('Failed to create API key:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

router.delete('/:id', requireAuth, permissionMiddleware('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'UPDATE api_keys SET is_active = false WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'API key not found' });
      return;
    }

    res.json({ message: 'API key revoked successfully' });
  } catch (error) {
    console.error('Failed to revoke API key:', error);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

router.post('/:id/activate', requireAuth, permissionMiddleware('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'UPDATE api_keys SET is_active = true WHERE id = $1 RETURNING id, is_active',
      [id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'API key not found' });
      return;
    }

    res.json({ message: 'API key activated successfully' });
  } catch (error) {
    console.error('Failed to activate API key:', error);
    res.status(500).json({ error: 'Failed to activate API key' });
  }
});

export default router;