import { Router, Request, Response } from 'express';
import { db } from '../../db/client.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

interface Channel {
  id: string;
  name: string;
  type: string;
  status: string;
  config: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await db.query<Channel>('SELECT * FROM channels ORDER BY created_at DESC');
    res.json({
      count: result.rows.length,
      channels: result.rows.map(ch => ({
        id: ch.id,
        name: ch.name,
        type: ch.type,
        status: ch.status,
        config: ch.config,
      })),
    });
  } catch (error) {
    res.json({
      count: 0,
      channels: [],
    });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, type, config } = req.body;
    const id = uuidv4();
    
    await db.query(
      `INSERT INTO channels (id, name, type, config, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [id, name, type, JSON.stringify(config || {}), 'pending']
    );
    
    res.json({
      success: true,
      channel: { id, name, type, status: 'pending' },
    });
  } catch (error) {
    res.status(400).json({ error: 'Failed to create channel', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.put('/:id/connect', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { credentials } = req.body;
    
    await db.query(
      `UPDATE channels SET config = config || $1, status = 'connected', updated_at = NOW() WHERE id = $2`,
      [JSON.stringify({ credentials }), id]
    );
    
    res.json({ success: true, status: 'connected' });
  } catch (error) {
    res.status(400).json({ error: 'Failed to connect channel' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM channels WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Failed to delete channel' });
  }
});

export default router;