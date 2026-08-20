import { all, get, run } from '../db.js';
import { layout, esc } from '../render.js';
import { readJson, sendJson } from '../router.js';
import {
  weekRange,
  todayStr,
  addDays,
  formatDisplayDate,
  weekdayLabel,
  isValidDateStr,
} from '../dateUtils.js';
import { STATUSES, STATUS_ORDER, isValidStatus } from '../statuses.js';
import { requireRole, requireRoleApi } from '../middleware.js';

async function getWeekEntries(employeeId, weekDates) {
  const placeholders = weekDates.map((_, i) => `$${i + 2}`).join(',');
  const rows = await all(
    `SELECT * FROM schedule_entries WHERE employee_id = $1 AND date IN (${placeholders})`,
    [employeeId, ...weekDates]
  );
  const map = {};
  for (const r of rows) map[r.date] = r;
  return map;
}

function legendHtml() {
  return `<div class="legend">${STATUS_ORDER.map(
    (key) =>
      `<span class="legend-item"><span class="dot" style="background:${STATUSES[key].color}"></span>${STATUSES[key].icon} ${STATUSES[key].label}</span>`
  ).join('')}</div>`;
}

function weekNavHtml(basePath, weekStart, extraQuery = '') {
  const prev = addDays(weekStart, -7);
  const next = addDays(weekStart, 7);
  const thisWeekStart = weekRange(todayStr())[0];
  return `<div class="week-nav">
    <a class="btn btn-ghost btn-sm" href="${basePath}?week=${prev}${extraQuery}">&larr; Prev</a>
    <span class="week-label">Week of ${esc(formatDisplayDate(weekStart, { year: 'numeric' }))}</span>
    <a class="btn btn-ghost btn-sm" href="${basePath}?week=${next}${extraQuery}">Next &rarr;</a>
    ${weekStart !== thisWeekStart ? `<a class="btn btn-ghost btn-sm" href="${basePath}?week=${thisWeekStart}${extraQuery}">Today</a>` : ''}
  </div>`;
}

function dayCellReadonly(entry) {
  if (!entry) return `<div class="cell cell-empty">Not set</div>`;
  const s = STATUSES[entry.status];
  return `<div class="cell" style="background:${s.tint};color:${s.color};border-color:${s.color}33">
    <span class="cell-status">${s.icon} ${s.label}</span>
    ${entry.start_time || entry.end_time ? `<span class="cell-time">${esc(entry.start_time || '')}${entry.start_time && entry.end_time ? '–' : ''}${esc(entry.end_time || '')}</span>` : ''}
    ${entry.note ? `<span class="cell-note">${esc(entry.note)}</span>` : ''}
  </div>`;
}

async function employeeScheduleHandler(req, res, ctx) {
  const user = ctx.user;
  if (!user.employee_id) {
    return res.end(
      layout({
        title: 'My Schedule',
        user,
        activePath: '/schedule',
        body: `<div class="panel"><h2>No employee profile linked</h2><p class="muted">Your account isn't linked to an employee record yet. Ask a manager to link your login to your schedule.</p></div>`,
      })
    );
  }
  const url = new URL(req.url, 'http://x');
  const weekParam = url.searchParams.get('week');
  const anchor = isValidDateStr(weekParam) ? weekParam : todayStr();
  const weekDates = weekRange(anchor);
  const entries = await getWeekEntries(user.employee_id, weekDates);
  const today = todayStr();

  const days = weekDates
    .map((d) => {
      return `<div class="day-col${d === today ? ' is-today' : ''}">
      <div class="day-head">${esc(weekdayLabel(d))}<span class="day-date">${esc(formatDisplayDate(d))}</span></div>
      ${dayCellReadonly(entries[d])}
    </div>`;
    })
    .join('');

  const html = layout({
    title: 'My Schedule',
    user,
    activePath: '/schedule',
    body: `
    <div class="page-head">
      <h1>My Schedule</h1>
      ${weekNavHtml('/schedule', weekDates[0])}
    </div>
    ${legendHtml()}
    <div class="week-grid">${days}</div>
    `,
  });
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

async function managerScheduleHandler(req, res, ctx) {
  const user = ctx.user;
  const url = new URL(req.url, 'http://x');
  const weekParam = url.searchParams.get('week');
  const anchor = isValidDateStr(weekParam) ? weekParam : todayStr();
  const weekDates = weekRange(anchor);
  const employees = await all('SELECT * FROM employees WHERE active = TRUE ORDER BY sort_order, name');
  const today = todayStr();

  const empIds = employees.map((e) => e.id);
  let entryMap = {};
  if (empIds.length) {
    const idPh = empIds.map((_, i) => `$${i + 1}`).join(',');
    const dateOffset = empIds.length;
    const datePh = weekDates.map((_, i) => `$${dateOffset + i + 1}`).join(',');
    const rows = await all(
      `SELECT * FROM schedule_entries WHERE employee_id IN (${idPh}) AND date IN (${datePh})`,
      [...empIds, ...weekDates]
    );
    for (const r of rows) entryMap[`${r.employee_id}_${r.date}`] = r;
  }

  const headerCells = weekDates
    .map(
      (d) =>
        `<th class="${d === today ? 'is-today' : ''}">${esc(weekdayLabel(d))}<br><span class="th-date">${esc(
          formatDisplayDate(d)
        )}</span></th>`
    )
    .join('');

  const rows = employees
    .map((emp) => {
      const cells = weekDates
        .map((d) => {
          const entry = entryMap[`${emp.id}_${d}`];
          const status = entry ? entry.status : '';
          const note = entry ? entry.note || '' : '';
          const opts = [
            `<option value="">— not set —</option>`,
            ...STATUS_ORDER.map(
              (key) =>
                `<option value="${key}" ${status === key ? 'selected' : ''}>${STATUSES[key].icon} ${STATUSES[key].label}</option>`
            ),
          ].join('');
          return `<td class="edit-cell" data-emp="${emp.id}" data-date="${d}">
            <select class="status-select status-${status || 'none'}" data-emp="${emp.id}" data-date="${d}">
              ${opts}
            </select>
            <input type="text" class="note-input" placeholder="note" value="${esc(note)}" data-emp="${emp.id}" data-date="${d}">
          </td>`;
        })
        .join('');
      return `<tr><th class="row-head">${esc(emp.name)}${emp.title ? `<span class="row-sub">${esc(emp.title)}</span>` : ''}</th>${cells}</tr>`;
    })
    .join('');

  const html = layout({
    title: 'Schedule',
    user,
    activePath: '/manager/schedule',
    body: `
    <div class="page-head">
      <h1>Team Schedule</h1>
      ${weekNavHtml('/manager/schedule', weekDates[0])}
    </div>
    ${legendHtml()}
    ${
      employees.length === 0
        ? `<div class="panel"><p class="muted">No active employees yet. <a href="/manager/employees">Add your team</a> to start building the schedule.</p></div>`
        : `<div class="table-scroll">
      <table class="grid-table" id="schedule-grid">
        <thead><tr><th class="row-head">Employee</th>${headerCells}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="muted small">Changes save automatically as you edit each cell.</p>`
    }
    `,
  });
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

async function updateScheduleApi(req, res, ctx) {
  const body = await readJson(req);
  const { employeeId, date, status, note, startTime, endTime } = body;
  if (!employeeId || !isValidDateStr(date)) {
    return sendJson(res, 400, { error: 'employeeId and a valid date are required.' });
  }
  if (status !== null && status !== undefined && status !== '' && !isValidStatus(status)) {
    return sendJson(res, 400, { error: 'Invalid status.' });
  }

  if (!status) {
    await run('DELETE FROM schedule_entries WHERE employee_id = $1 AND date = $2', [employeeId, date]);
    return sendJson(res, 200, { ok: true, cleared: true });
  }

  const existing = await get('SELECT id FROM schedule_entries WHERE employee_id = $1 AND date = $2', [
    employeeId,
    date,
  ]);
  if (existing) {
    await run(
      `UPDATE schedule_entries SET status = $1, note = $2, start_time = $3, end_time = $4, updated_by = $5, updated_at = NOW() WHERE id = $6`,
      [status, note || null, startTime || null, endTime || null, ctx.user.id, existing.id]
    );
  } else {
    await run(
      `INSERT INTO schedule_entries (employee_id, date, status, note, start_time, end_time, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [employeeId, date, status, note || null, startTime || null, endTime || null, ctx.user.id]
    );
  }
  return sendJson(res, 200, { ok: true });
}

export function registerScheduleRoutes(router) {
  router.get('/schedule', requireRole(['EMPLOYEE', 'MANAGER', 'ADMIN'], employeeScheduleHandler));
  router.get('/manager/schedule', requireRole(['MANAGER', 'ADMIN'], managerScheduleHandler));
  router.patch('/api/schedule', requireRoleApi(['MANAGER', 'ADMIN'], updateScheduleApi));
}
