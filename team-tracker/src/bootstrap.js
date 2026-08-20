// Production-friendly first-run setup: if the database has no users yet and
// BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD are set as environment
// variables, create the first Admin account automatically so the app can go
// live without a shell session to run `npm run seed`.
import { get, run } from './db.js';
import { hashPassword } from './auth.js';

let didRun = false;

export async function runBootstrap() {
  if (didRun) return; // avoid repeat work on warm serverless invocations
  didRun = true;

  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || '';

  const row = await get('SELECT COUNT(*)::int as c FROM users');
  const userCount = Number(row.c);
  if (userCount > 0) return;

  if (!email || !password) {
    console.log(
      'No users exist yet. Run "npm run seed" for demo data, or set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD env vars and redeploy/restart to create a real first Admin account.'
    );
    return;
  }

  await run('INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)', [
    'Admin',
    email,
    hashPassword(password),
    'ADMIN',
  ]);
  console.log(`Bootstrapped first Admin account: ${email}`);
}
