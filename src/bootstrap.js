// Production-friendly first-run setup: if the database has no users yet and
// BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD are set as environment
// variables, create the first Admin account automatically so the app can go
// live without a shell session to run `npm run seed`.
import { get, run } from './db.js';
import { hashPassword } from './auth.js';

// `didRun` only latches once bootstrap reaches a FINAL state (users already
// exist, or we just created the admin) — never on the "not configured yet"
// path. Warm serverless containers reuse this module across invocations, so
// if we cached "done" the moment BOOTSTRAP_ADMIN_EMAIL/PASSWORD happened to
// be unset, a still-warm container would never notice you added the env
// vars later — it would keep skipping bootstrap for its entire lifetime
// (until Netlify happened to cold-start a fresh instance). Re-checking each
// time is one cheap COUNT query and guarantees adding the env vars takes
// effect on the very next request, no redeploy required.
let didRun = false;

export async function runBootstrap() {
  if (didRun) return; // avoid repeat work once we know we're done

  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || '';

  const row = await get('SELECT COUNT(*)::int as c FROM users');
  const userCount = Number(row.c);
  if (userCount > 0) {
    didRun = true;
    return;
  }

  if (!email || !password) {
    console.log(
      'No users exist yet. Run "npm run seed" for demo data, or set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD env vars to create a real first Admin account on the next request.'
    );
    return; // deliberately NOT setting didRun — retry on the next request
  }

  await run('INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)', [
    'Admin',
    email,
    hashPassword(password),
    'ADMIN',
  ]);
  didRun = true;
  console.log(`Bootstrapped first Admin account: ${email}`);
}
