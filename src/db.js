// Postgres data layer, backed by Netlify DB (zero-config Postgres). When the
// app runs on Netlify, @netlify/database auto-provisions and connects to the
// right database for the current environment (production vs. deploy preview
// branches) with no connection string to manage.
//
// When running elsewhere (your own VPS, Render, local dev outside `netlify
// dev`), set DATABASE_URL to any Postgres connection string and it's used
// instead — getDatabase({ connectionString }) accepts an explicit override.
import { getDatabase } from '@netlify/database';

const db = process.env.DATABASE_URL
  ? getDatabase({ connectionString: process.env.DATABASE_URL })
  : getDatabase();

export const pool = db.pool;

export async function all(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function get(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}

export async function run(sql, params = []) {
  return pool.query(sql, params);
}
