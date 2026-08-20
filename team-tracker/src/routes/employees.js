import { all, get, run } from '../db.js';
import { layout, esc, redirect } from '../render.js';
import { readForm } from '../router.js';
import { requireRole } from '../middleware.js';
import { hashPassword, generateTempPassword } from '../auth.js';

function employeesPage(user, employees, flash) {
  const rows = employees
    .map((emp) => {
      const loginRow = emp.user_email
        ? `<span class="pill pill-ok">Login: ${esc(emp.user_email)}</span>`
        : `<span class="pill pill-muted">No login</span>`;
      return `<tr class="${emp.active ? '' : 'row-inactive'}">
        <td>
          <form method="POST" action="/manager/employees/${emp.id}/update" class="inline-edit-form">
            <input type="text" name="name" value="${esc(emp.name)}" class="mini-input" required>
            <input type="text" name="title" value="${esc(emp.title || '')}" class="mini-input" placeholder="Title/role">
            <input type="email" name="email" value="${esc(emp.email || '')}" class="mini-input" placeholder="Email">
            <button class="btn btn-sm btn-secondary" type="submit">Save</button>
          </form>
        </td>
        <td>${loginRow}
          ${
            !emp.user_email
              ? `<form method="POST" action="/manager/employees/${emp.id}/create-login" class="inline-form">
              <button class="btn btn-sm btn-ghost" type="submit">Create login</button>
            </form>`
              : `<form method="POST" action="/manager/employees/${emp.id}/reset-password" class="inline-form">
              <button class="btn btn-sm btn-ghost" type="submit">Reset password</button>
            </form>`
          }
        </td>
        <td>
          <form method="POST" action="/manager/employees/${emp.id}/toggle" class="inline-form">
            <button class="btn btn-sm ${emp.active ? 'btn-danger-ghost' : 'btn-secondary'}" type="submit">${emp.active ? 'Deactivate' : 'Reactivate'}</button>
          </form>
        </td>
      </tr>`;
    })
    .join('');

  return layout({
    title: 'Employees',
    user,
    activePath: '/manager/employees',
    flash,
    body: `
    <div class="page-head"><h1>Employees</h1></div>

    <div class="panel">
      <h2>Add employee</h2>
      <form method="POST" action="/manager/employees" class="form-row">
        <label class="field"><span>Name</span><input type="text" name="name" required></label>
        <label class="field"><span>Title / role</span><input type="text" name="title" placeholder="e.g. Support Agent"></label>
        <label class="field"><span>Email</span><input type="email" name="email" placeholder="optional"></label>
        <label class="field checkbox-field"><input type="checkbox" name="createLogin" checked> <span>Create a login for this employee</span></label>
        <button class="btn btn-primary" type="submit">Add employee</button>
      </form>
    </div>

    <div class="table-scroll">
      <table class="data-table">
        <thead><tr><th>Employee</th><th>Login</th><th>Status</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="3" class="muted">No employees yet.</td></tr>`}</tbody>
      </table>
    </div>
    `,
  });
}

function tempPasswordPage(user, email, tempPassword, label) {
  return layout({
    title: 'Temporary password',
    user,
    activePath: '/manager/employees',
    body: `
    <div class="panel panel-highlight">
      <h2>${esc(label)}</h2>
      <p>Share these credentials with the employee. This password is shown once — it is not stored anywhere readable.</p>
      <dl class="kv">
        <dt>Email</dt><dd><code>${esc(email)}</code></dd>
        <dt>Temporary password</dt><dd><code>${esc(tempPassword)}</code></dd>
      </dl>
      <a class="btn btn-primary" href="/manager/employees">Back to employees</a>
    </div>
    `,
  });
}

async function listHandler(req, res, ctx) {
  const employees = await all(`
    SELECT e.*, u.email as user_email
    FROM employees e
    LEFT JOIN users u ON u.employee_id = e.id
    ORDER BY e.active DESC, e.sort_order, e.name
  `);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(employeesPage(ctx.user, employees, null));
}

async function createHandler(req, res, ctx) {
  const form = await readForm(req);
  const name = (form.name || '').trim();
  if (!name) return redirect(res, '/manager/employees');
  const title = (form.title || '').trim() || null;
  const email = (form.email || '').trim() || null;

  const result = await run('INSERT INTO employees (name, title, email) VALUES ($1, $2, $3) RETURNING id', [
    name,
    title,
    email,
  ]);
  const employeeId = result.rows[0].id;

  if (form.createLogin && email) {
    const existing = await get('SELECT id FROM users WHERE lower(email) = $1', [email.toLowerCase()]);
    if (!existing) {
      const tempPassword = generateTempPassword();
      await run(
        'INSERT INTO users (name, email, password_hash, role, employee_id, must_change_password) VALUES ($1, $2, $3, $4, $5, TRUE)',
        [name, email, hashPassword(tempPassword), 'EMPLOYEE', employeeId]
      );
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(tempPasswordPage(ctx.user, email, tempPassword, `Login created for ${name}`));
    }
  }
  redirect(res, '/manager/employees');
}

async function updateHandler(req, res, ctx) {
  const { id } = ctx.params;
  const form = await readForm(req);
  const name = (form.name || '').trim();
  const title = (form.title || '').trim() || null;
  const email = (form.email || '').trim() || null;
  if (!name) return redirect(res, '/manager/employees');
  await run('UPDATE employees SET name = $1, title = $2, email = $3 WHERE id = $4', [name, title, email, id]);
  redirect(res, '/manager/employees');
}

async function toggleHandler(req, res, ctx) {
  const { id } = ctx.params;
  const emp = await get('SELECT * FROM employees WHERE id = $1', [id]);
  if (emp) {
    await run('UPDATE employees SET active = $1 WHERE id = $2', [!emp.active, id]);
  }
  redirect(res, '/manager/employees');
}

async function createLoginHandler(req, res, ctx) {
  const { id } = ctx.params;
  const emp = await get('SELECT * FROM employees WHERE id = $1', [id]);
  if (!emp) return redirect(res, '/manager/employees');
  if (!emp.email) {
    return redirect(res, '/manager/employees');
  }
  const existing = await get('SELECT id FROM users WHERE lower(email) = $1', [emp.email.toLowerCase()]);
  if (existing) return redirect(res, '/manager/employees');
  const tempPassword = generateTempPassword();
  await run(
    'INSERT INTO users (name, email, password_hash, role, employee_id, must_change_password) VALUES ($1, $2, $3, $4, $5, TRUE)',
    [emp.name, emp.email, hashPassword(tempPassword), 'EMPLOYEE', emp.id]
  );
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(tempPasswordPage(ctx.user, emp.email, tempPassword, `Login created for ${emp.name}`));
}

async function resetPasswordHandler(req, res, ctx) {
  const { id } = ctx.params;
  const user = await get('SELECT * FROM users WHERE employee_id = $1', [id]);
  if (!user) return redirect(res, '/manager/employees');
  const tempPassword = generateTempPassword();
  await run('UPDATE users SET password_hash = $1, must_change_password = TRUE WHERE id = $2', [
    hashPassword(tempPassword),
    user.id,
  ]);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(tempPasswordPage(ctx.user, user.email, tempPassword, `Password reset for ${user.name}`));
}

export function registerEmployeeRoutes(router) {
  router.get('/manager/employees', requireRole(['MANAGER', 'ADMIN'], listHandler));
  router.post('/manager/employees', requireRole(['MANAGER', 'ADMIN'], createHandler));
  router.post('/manager/employees/:id/update', requireRole(['MANAGER', 'ADMIN'], updateHandler));
  router.post('/manager/employees/:id/toggle', requireRole(['MANAGER', 'ADMIN'], toggleHandler));
  router.post(
    '/manager/employees/:id/create-login',
    requireRole(['MANAGER', 'ADMIN'], createLoginHandler)
  );
  router.post(
    '/manager/employees/:id/reset-password',
    requireRole(['MANAGER', 'ADMIN'], resetPasswordHandler)
  );
}
