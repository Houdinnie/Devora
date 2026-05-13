import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sessionStore, CreateSessionInput } from '../../memory/session.js';

const router = Router();

const CreateSessionSchema = z.object({
  name: z.string().min(1).max(255),
  metadata: z.record(z.unknown()).optional(),
  context: z.record(z.unknown()).optional(),
});

const UpdateSessionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
  context: z.record(z.unknown()).optional(),
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const sessions = await sessionStore.list(limit, offset);
    
    res.json({
      count: sessions.length,
      sessions: sessions.map(s => ({
        id: s.id,
        name: s.name,
        created_at: s.created_at,
        updated_at: s.updated_at,
        last_activity_at: s.last_activity_at,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const input = CreateSessionSchema.parse(req.body);
    
    const session = await sessionStore.create(input as CreateSessionInput);
    
    res.status(201).json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create session';
    res.status(400).json({ error: 'Create session failed', message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const session = await sessionStore.get(id);
    
    if (!session) {
      res.status(404).json({ error: 'Session not found', id });
      return;
    }
    
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get session' });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = UpdateSessionSchema.parse(req.body);
    
    const session = await sessionStore.update(id, updates);
    
    if (!session) {
      res.status(404).json({ error: 'Session not found', id });
      return;
    }
    
    res.json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update session';
    res.status(400).json({ error: 'Update session failed', message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await sessionStore.delete(id);
    
    if (!deleted) {
      res.status(404).json({ error: 'Session not found', id });
      return;
    }
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    
    const session = await sessionStore.get(id);
    if (!session) {
      res.status(404).json({ error: 'Session not found', id });
      return;
    }
    
    const history = await sessionStore.history(id, limit);
    
    res.json({
      sessionId: id,
      count: history.length,
      history,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get session history' });
  }
});

export default router;