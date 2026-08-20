// Minimal .env loader (no external dependencies available). Only relevant
// for non-Netlify hosting (server.js) — on Netlify, env vars are provided by
// the platform directly and no .env file exists.
//
// Deliberately avoids declaring `__dirname` here: Netlify's function bundler
// (esbuild) auto-injects its own `__dirname` shim into bundled ESM functions
// for Node compatibility, and a second top-level `const __dirname = ...`
// declaration collides with it — a SyntaxError that crashes the function on
// every invocation. Using a `new URL(...)` relative to import.meta.url
// avoids needing the identifier at all.
import { readFileSync, existsSync } from 'node:fs';

const envUrl = new URL('../.env', import.meta.url);

if (existsSync(envUrl)) {
  const raw = readFileSync(envUrl, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  appTz: process.env.APP_TZ || 'America/Mexico_City',
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  cookieSecure: (process.env.COOKIE_SECURE || 'false').toLowerCase() === 'true',
};
