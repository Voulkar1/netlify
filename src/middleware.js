import { redirect } from './render.js';
import { sendJson } from './router.js';

// For page (HTML) routes: redirects to /login or shows a 403 page.
export function requireRole(roles, handler) {
  return async (req, res, ctx) => {
    if (!ctx.user) {
      return redirect(res, '/login');
    }
    if (!roles.includes(ctx.user.role)) {
      res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>403 — Not authorized</h1><p><a href="/">Go home</a></p>');
      return;
    }
    return handler(req, res, ctx);
  };
}

// For JSON API routes: responds with JSON errors instead of redirects.
export function requireRoleApi(roles, handler) {
  return async (req, res, ctx) => {
    if (!ctx.user) return sendJson(res, 401, { error: 'Not authenticated.' });
    if (!roles.includes(ctx.user.role)) return sendJson(res, 403, { error: 'Not authorized.' });
    return handler(req, res, ctx);
  };
}
