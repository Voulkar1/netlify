import { all, get, run } from '../db.js';
import { layout, esc, redirect } from '../render.js';
import { readForm } from '../router.js';
import { requireRole } from '../middleware.js';
import { hashPassword, generateTempPassword } from '../auth.js';

function usersPage(user, users, employees, flash) {
  const rows = users
    .map(
      (u) => `<tr>
      <td>${esc(u.name)}${u.id === user.id ? ' <span class="pill pill-muted">you</span>' : ''}</td>
      <td>${esc(u.email)}</td>
      <td><span class="role-pill role-${esc(u.role)}">${esc(u.role)}</span></td>
      <td>${u.employee_name ? esc(u.employee_name) : '<span class="muted">—</span>'}</td>
      <td>
        <form method="POST" action="/manager/users/${u.id}/reset-password" class="inline-form">
          <button class="btn btn-xs btn-ghost" type="submit">Reset password</button>
        </form>
        ${
          u.id !== user.id
            ? `<form method="POST" action="/manager/users/${u.id}/delete" class="inline-form" onsubmit="return confirm('Remove this login?');">
              <button class="btn btn-xs btn-danger-ghost" type="submit">Remove</button>
            </form>`
            : ''
        }
      </td>
    </tr>`
    )
    .join('');

  const employeeOptions = employees
    .map((e) => `<option value="${e.id}">${esc(e.name)}</option>`)
    .join('');

  return layout({
    title: 'User Accounts',
    user,
    activePath: '/manager/users',
    flash,
    body: `
    <div class="page-head"><h1>User Accounts</h1></div>

    <div class="panel">
      <h2>Create a login</h2>
      <form method="POST" action="/manager/users" class="form-row">
        <label class="field"><span>Name</span><input type="text" name="name" required></label>
        <label class="field"><span>Email</span><input type="email" name="email" required></label>
        <label class="field"><span>Role</span>
          <select name="role">
            <option value="EMPLOYEE">Employee</option>
            <option value="MANAGER">Manager</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
        <label class="field"><span>Linked employee (optional)</span>
          <select name="employeeId">
            <option value="">— none —</option>
            ${employeeOptions}
          </select>
        </label>
        <button class="btn btn-primary" type="submit">Create login</button>
      </form>
    </div>

    <div class="table-scroll">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Linked employee</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    `,
  });
}

function tempPasswordPage(user, email, tempPassword, label) {
  return layout({
    title: 'Temporary password',
    user,
    activePath: '/manager/users',
    body: `
    <div class="panel panel-highlight">
      <h2>${esc(label)}</h2>
      <p>Share these credentials securely. This password is shown once.</p>
      <dl class="kv">
        <dt>Email</dt><dd><code>${esc(email)}</code></dd>
        <dt>Temporary password</dt><dd><code>${esc(tempPassword)}</code></dd>
      </dl>
      <a class="btn btn-primary" href="/manager/users">Back to user accounts</a>
    </div>
    `,
  });
}

async function listHandler(req, res, ctx) {
  const users = await all(`
    SELECT u.*, e.name as employee_name
    FROM users u
    LEFT JOIN employees e ON e.id = u.employee_id
    ORDER BY u.role, u.name
  `);
  const employees = await all('SELECT * FROM employees WHERE active = TRUE ORDER BY name');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(usersPage(ctx.user, users, employees, null));
}

async function createHandler(req, res, ctx) {
  const form = await readForm(req);
  const name = (form.name || '').trim();
  const email = (form.email || '').trim().toLowerCase();
  const role = ['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(form.role) ? form.role : 'EMPLOYEE';
  const employeeId = form.employeeId ? Number(form.employeeId) : null;
  if (!name || !email) return redirect(res, '/manager/users');

  const existing = await get('SELECT id FROM users WHERE lower(email) = $1', [email]);
  if (existing) return redirect(res, '/manager/users');

  const tempPassword = generateTempPassword();
  await run(
    'INSERT INTO users (name, email, password_hash, role, employee_id, must_change_password) VALUES ($1, $2, $3, $4, $5, TRUE)',
    [name, email, hashPassword(tempPassword), role, employeeId]
  );
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(tempPasswordPage(ctx.user, email, tempPassword, `Login created for ${name}`));
}

async function resetPasswordHandler(req, res, ctx) {
  const { id } = ctx.params;
  const target = await get('SELECT * FROM users WHERE id = $1', [id]);
  if (!target) return redirect(res, '/manager/users');
  const tempPassword = generateTempPassword();
  await run('UPDATE users SET password_hash = $1, must_change_password = TRUE WHERE id = $2', [
    hashPassword(tempPassword),
    id,
  ]);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(tempPasswordPage(ctx.user, target.email, tempPassword, `Password reset for ${target.name}`));
}

async function deleteHandler(req, res, ctx) {
  const { id } = ctx.params;
  if (String(id) === String(ctx.user.id)) return redirect(res, '/manager/users');
  await run('DELETE FROM users WHERE id = $1', [id]);
  redirect(res, '/manager/users');
}

export function registerUserRoutes(router) {
  router.get('/manager/users', requireRole(['ADMIN'], listHandler));
  router.post('/manager/users', requireRole(['ADMIN'], createHandler));
  router.post('/manager/users/:id/reset-password', requireRole(['ADMIN'], resetPasswordHandler));
  router.post('/manager/users/:id/delete', requireRole(['ADMIN'], deleteHandler));
}
