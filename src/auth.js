import crypto from 'node:crypto';
import { get, run } from './db.js';
import { config } from './config.js';

const SESSION_DAYS = 14;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(candidate, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await run('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)', [
    token,
    userId,
    expires.toISOString(),
  ]);
  return { token, expires };
}

export async function destroySession(token) {
  if (!token) return;
  await run('DELETE FROM sessions WHERE token = $1', [token]);
}

export async function getUserFromToken(token) {
  if (!token) return null;
  const session = await get('SELECT * FROM sessions WHERE token = $1', [token]);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await run('DELETE FROM sessions WHERE token = $1', [token]);
    return null;
  }
  const user = await get(
    `SELECT u.*, e.name as employee_name FROM users u
     LEFT JOIN employees e ON e.id = u.employee_id
     WHERE u.id = $1`,
    [session.user_id]
  );
  return user || null;
}

export function parseCookies(req) {
  const header =
    typeof req.headers?.get === 'function' ? req.headers.get('cookie') : req.headers?.cookie;
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    cookies[key] = val;
  }
  return cookies;
}

export function setSessionCookie(res, token, expires) {
  const parts = [
    `session=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Expires=${expires.toUTCString()}`,
  ];
  if (config.cookieSecure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res) {
  const parts = [
    'session=',
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  if (config.cookieSecure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function generateTempPassword() {
  // Human-friendly-ish random password, e.g. "b7k2-m9pq"
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) out += '-';
    out += chars[crypto.randomInt(chars.length)];
  }
  return out;
}
