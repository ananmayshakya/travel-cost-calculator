import { Pool, type QueryResultRow } from 'pg';
import 'dotenv/config';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set — copy .env.example to .env and fill it in');
}

// shared connection pool to the Neon database
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// runs a parameterized query against the pool and returns its rows
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}
