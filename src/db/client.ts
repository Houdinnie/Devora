import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_SYNC;

let pool: pg.Pool | null = null;
let dbReady = false;

async function initDatabase() {
  if (!connectionString) {
    console.log('⚠ No DATABASE_URL - using in-memory mode');
    return;
  }

  try {
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });

    // Test connection
    await pool.query('SELECT 1');
    dbReady = true;
    console.log('✓ PostgreSQL connected');
  } catch (error) {
    console.log('⚠ PostgreSQL connection failed - using in-memory mode');
    pool = null;
  }
}

initDatabase();

export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number | null }> {
  if (!dbReady || !pool) {
    return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] } as any;
  }
  
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('Executed query', { text: text.substring(0, 50), duration, rows: result.rowCount });
  return { rows: result.rows as T[], rowCount: result.rowCount };
}

export async function getClient(): Promise<pg.PoolClient> {
  if (!pool) throw new Error('Database not available');
  return pool.connect();
}

export async function transaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  if (!pool) throw new Error('Database not available');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function healthCheck(): Promise<boolean> {
  if (!dbReady || !pool) return false;
  try {
    const result = await pool.query('SELECT 1');
    return result.rowCount === 1;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  if (pool) await pool.end();
}

export const db = {
  query,
  getClient,
  transaction,
  healthCheck,
  closePool,
  pool,
};

export function isDbReady(): boolean {
  return dbReady;
}

export type DbClient = pg.Pool;
export default db;