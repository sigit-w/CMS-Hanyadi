import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool(config.db);

export async function query(text, params) {
  return pool.query(text, params);
}

export async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function databaseIsUp() {
  const result = await query('SELECT 1 AS ok');
  return result.rows[0].ok === 1;
}
