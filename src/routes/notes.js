import { all, get, run } from '../db.js';
import { layout, esc, redirect } from '../render.js';
import { readForm } from '../router.js';
import { requireRole } from '../middleware.js';
import { currentMonthKey, monthLabel } from '../dateUtils.js';

function formatTimestamp(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

function notesPage({ user, month, notes, isCurrent, pastMonths }) {
  const canEdit = isCurrent && (user.role === 'MANAGER' || user.role === 'ADMIN');
  const noteItems = notes
    .map(
      (n) => `<li class="note-item">
      <div class="note-content">${esc(n.content).replace(/\n/g, '<br>')}</div>
      <div class="note-meta">
        <span>${esc(n.created_by_name || 'Unknown')}</span>
        <span>${esc(formatTimestamp(n.created_at))}</span>
        ${
          canEdit
            ? `<form method="POST" action="/notes/${n.id}/delete" class="inline-form" onsubmit="return confirm('Delete this note?');">
              <button class="btn btn-xs btn-danger-ghost" type="submit">Delete</button>
            </form>`
            : ''
        }
      </div>
    </li>`
    )
    .join('');

  const historyOptions = pastMonths
    .map((m) => `<option value="${m}" ${m === month ? 'selected' : ''}>${esc(monthLabel(m))}</option>`)
    .join('');

  return layout({
    title: 'Notes',
    user,
    activePath: '/notes',
    body: `
    <div class="page-head">
      <h1>Monthly Notes${!isCurrent ? ' — Archive' : ''}</h1>
      <form method="GET" action="/notes" class="inline-form">
        <select name="month" onchange="this.form.submit()">
          <option value="">${esc(monthLabel(currentMonthKey()))} (current)</option>
          ${historyOptions}
        </select>
      </form>
    </div>

    <div class="panel">
      <p class="muted">
        ${
          isCurrent
            ? 'Notes here are for the current month only. When a new month starts, this board automatically starts fresh — nothing carries over, but past months stay available in the history dropdown above.'
            : 'This is a read-only view of a past month. Notes cannot be edited once the month has passed.'
        }
      </p>
    </div>

    ${
      canEdit
        ? `<div class="panel">
      <h2>Add a note for ${esc(monthLabel(month))}</h2>
      <form method="POST" action="/notes" class="stack">
        <textarea name="content" rows="3" required placeholder="e.g. Schedule swap: Ana covering Luis's Friday shift starting the 20th."></textarea>
        <button class="btn btn-primary" type="submit">Add note</button>
      </form>
    </div>`
        : ''
    }

    <ul class="note-list">
      ${noteItems || `<li class="muted">No notes for ${esc(monthLabel(month))} yet.</li>`}
    </ul>
    `,
  });
}

async function notesHandler(req, res, ctx) {
  const url = new URL(req.url, 'http://x');
  const monthParam = url.searchParams.get('month');
  const current = currentMonthKey();
  const month = /^\d{4}-\d{2}$/.test(monthParam || '') ? monthParam : current;

  const notes = await all('SELECT * FROM monthly_notes WHERE month = $1 ORDER BY created_at DESC', [month]);
  const pastMonthRows = await all(
    `SELECT DISTINCT month FROM monthly_notes WHERE month < $1 ORDER BY month DESC LIMIT 24`,
    [current]
  );
  const pastMonths = pastMonthRows.map((r) => r.month);

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(
    notesPage({
      user: ctx.user,
      month,
      notes,
      isCurrent: month === current,
      pastMonths,
    })
  );
}

async function createHandler(req, res, ctx) {
  const form = await readForm(req);
  const content = (form.content || '').trim();
  if (!content) return redirect(res, '/notes');
  const month = currentMonthKey();
  await run(
    'INSERT INTO monthly_notes (month, content, created_by, created_by_name) VALUES ($1, $2, $3, $4)',
    [month, content, ctx.user.id, ctx.user.name]
  );
  redirect(res, '/notes');
}

async function deleteHandler(req, res, ctx) {
  const { id } = ctx.params;
  const note = await get('SELECT * FROM monthly_notes WHERE id = $1', [id]);
  const current = currentMonthKey();
  if (note && note.month === current) {
    await run('DELETE FROM monthly_notes WHERE id = $1', [id]);
  }
  redirect(res, '/notes');
}

export function registerNoteRoutes(router) {
  router.get('/notes', requireRole(['EMPLOYEE', 'MANAGER', 'ADMIN'], notesHandler));
  router.post('/notes', requireRole(['MANAGER', 'ADMIN'], createHandler));
  router.post('/notes/:id/delete', requireRole(['MANAGER', 'ADMIN'], deleteHandler));
}
