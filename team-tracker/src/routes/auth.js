import { get } from '../db.js';
import {
  verifyPassword,
  createSession,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
  parseCookies,
} from '../auth.js';
import { layout, esc, redirect } from '../render.js';
import { readForm } from '../router.js';

export function registerAuthRoutes(router) {
  router.get('/login', async (req, res, ctx) => {
    if (ctx.user) return redirect(res, homeFor(ctx.user));
    const url = new URL(req.url, 'http://x');
    const error = url.searchParams.get('error');
    const html = loginPage({ error });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  router.post('/login', async (req, res) => {
    const form = await readForm(req);
    const email = (form.email || '').trim().toLowerCase();
    const password = form.password || '';
    const user = await get('SELECT * FROM users WHERE lower(email) = $1', [email]);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return redirect(res, '/login?error=' + encodeURIComponent('Incorrect email or password.'));
    }
    const { token, expires } = await createSession(user.id);
    setSessionCookie(res, token, expires);
    redirect(res, homeFor(user));
  });

  router.post('/logout', async (req, res, ctx) => {
    const cookies = parseCookies(req);
    await destroySession(cookies.session);
    clearSessionCookie(res);
    redirect(res, '/login');
  });
}

export function homeFor(user) {
  if (!user) return '/login';
  if (user.role === 'EMPLOYEE') return '/schedule';
  return '/manager/schedule';
}

function loginPage({ error }) {
  return layout({
    title: 'Log in',
    user: null,
    body: `
    <div class="auth-wrap">
      <div class="auth-card">
        <h1 class="auth-title">Team Tracker</h1>
        <p class="auth-sub">Sign in to view or manage the schedule.</p>
        ${error ? `<div class="flash flash-error">${esc(error)}</div>` : ''}
        <form method="POST" action="/login" class="stack">
          <label class="field">
            <span>Email</span>
            <input type="email" name="email" required autofocus autocomplete="username">
          </label>
          <label class="field">
            <span>Password</span>
            <input type="password" name="password" required autocomplete="current-password">
          </label>
          <button class="btn btn-primary btn-block" type="submit">Log in</button>
        </form>
      </div>
    </div>`,
  });
}
