import { Pool } from 'pg';
import { config } from './config.js';

export const pool = new Pool(config.db);

export async function databaseIsUp() {
  try {
    const { rows } = await pool.query('SELECT 1 AS ok');
    return rows[0]?.ok === 1;
  } catch {
    return false;
  }
}
