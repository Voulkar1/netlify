// Postgres data layer, backed by Netlify DB (zero-config Postgres). When the
// app runs on Netlify, @netlify/database auto-provisions and connects to the
// right database for the current environment (production vs. deploy preview
// branches) with no connection string to manage.
//
// When running elsewhere (your own VPS, Render, local dev outside `netlify
// dev`), set DATABASE_URL to any Postgres connection string and it's used
// instead — getDatabase({ connectionString }) accepts an explicit override.
//
// IMPORTANT: the actual getDatabase() call is deliberately lazy (called on
// first use, inside a request, not at module load time). Netlify's own
// guidance for serverless functions is to avoid global side-effecting logic
// outside the exported handler — connecting to the database is exactly that
// kind of side effect, so we defer it until the first query instead of
// running it the moment this module is imported.
import { getDatabase } from '@netlify/database';

let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = Promise.resolve().then(() => {
      const db = process.env.DATABASE_URL
        ? getDatabase({ connectionString: process.env.DATABASE_URL })
        : getDatabase();
      return db.pool;
    });
  }
  return poolPromise;
}

export async function all(sql, params = []) {
  const pool = await getPool();
  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function get(sql, params = []) {
  const pool = await getPool();
  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}

export async function run(sql, params = []) {
  const pool = await getPool();
  return pool.query(sql, params);
}
