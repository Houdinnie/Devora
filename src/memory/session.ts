import { v4 as uuidv4 } from 'uuid';
import db from '../db/client.js';

export interface Session {
  id: string;
  name: string;
  metadata: Record<string, unknown>;
  context: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  last_activity_at: Date;
}

export interface CreateSessionInput {
  name: string;
  metadata?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export async function createSession(input: CreateSessionInput): Promise<Session> {
  const result = await db.query<Session>(
    `INSERT INTO sessions (name, metadata, context)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [
      input.name,
      JSON.stringify(input.metadata || {}),
      JSON.stringify(input.context || {}),
    ]
  );
  return result.rows[0];
}

export async function getSession(id: string): Promise<Session | null> {
  const result = await db.query<Session>(
    'SELECT * FROM sessions WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

export async function updateSession(
  id: string,
  updates: Partial<Session>
): Promise<Session | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.metadata !== undefined) {
    fields.push(`metadata = $${paramIndex++}`);
    values.push(JSON.stringify(updates.metadata));
  }
  if (updates.context !== undefined) {
    fields.push(`context = $${paramIndex++}`);
    values.push(JSON.stringify(updates.context));
  }

  if (fields.length === 0) {
    return getSession(id);
  }

  values.push(id);
  const result = await db.query<Session>(
    `UPDATE sessions SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function updateSessionActivity(id: string): Promise<void> {
  await db.query(
    'UPDATE sessions SET last_activity_at = NOW() WHERE id = $1',
    [id]
  );
}

export async function listSessions(
  limit = 50,
  offset = 0
): Promise<Session[]> {
  const result = await db.query<Session>(
    'SELECT * FROM sessions ORDER BY last_activity_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return result.rows;
}

export async function deleteSession(id: string): Promise<boolean> {
  const result = await db.query(
    'DELETE FROM sessions WHERE id = $1',
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getSessionHistory(
  sessionId: string,
  limit = 100
): Promise<unknown[]> {
  const result = await db.query(
    `SELECT w.id, w.workflow_name, w.status, w.created_at, w.completed_at,
            w.inputs, w.outputs, w.agent_results
     FROM workflow_runs w
     WHERE w.session_id = $1
     ORDER BY w.created_at DESC
     LIMIT $2`,
    [sessionId, limit]
  );
  return result.rows;
}

export const sessionStore = {
  create: createSession,
  get: getSession,
  update: updateSession,
  updateActivity: updateSessionActivity,
  list: listSessions,
  delete: deleteSession,
  history: getSessionHistory,
};

export default sessionStore;