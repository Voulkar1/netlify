import { all } from '../db.js';
import { layout, esc } from '../render.js';
import { requireRole } from '../middleware.js';
import { todayStr, isValidDateStr, formatDisplayDate } from '../dateUtils.js';
import { STATUSES, STATUS_ORDER } from '../statuses.js';

function monthToDateRange() {
  const today = todayStr();
  const start = today.slice(0, 8) + '01';
  return { start, end: today };
}

function buildCounts(rows, employees) {
  const byEmp = {};
  for (const emp of employees) {
    byEmp[emp.id] = { employee: emp, counts: Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])), total: 0 };
  }
  for (const r of rows) {
    if (!byEmp[r.employee_id]) continue;
    byEmp[r.employee_id].counts[r.status] = r.cnt;
    byEmp[r.employee_id].total += r.cnt;
  }
  return Object.values(byEmp);
}

function legendHtml() {
  return `<div class="legend">${STATUS_ORDER.map(
    (key) =>
      `<span class="legend-item"><span class="dot" style="background:${STATUSES[key].color}"></span>${STATUSES[key].icon} ${STATUSES[key].label}</span>`
  ).join('')}</div>`;
}

function barHtml(row, maxTotal) {
  if (maxTotal === 0) return `<div class="bar-track"></div>`;
  const segments = STATUS_ORDER.filter((s) => row.counts[s] > 0)
    .map((s) => {
      const pct = (row.counts[s] / maxTotal) * 100;
      return `<div class="bar-seg" style="width:${pct}%;background:${STATUSES[s].color}" title="${STATUSES[s].label}: ${row.counts[s]}"></div>`;
    })
    .join('');
  return `<div class="bar-track">${segments}</div>`;
}

async function reportsHandler(req, res, ctx) {
  const url = new URL(req.url, 'http://x');
  const startParam = url.searchParams.get('start');
  const endParam = url.searchParams.get('end');
  const empParam = url.searchParams.get('employee') || '';
  const defaults = monthToDateRange();
  const start = isValidDateStr(startParam) ? startParam : defaults.start;
  const end = isValidDateStr(endParam) ? endParam : defaults.end;

  const employees = await all('SELECT * FROM employees ORDER BY active DESC, sort_order, name');

  let query = `SELECT employee_id, status, COUNT(*)::int as cnt FROM schedule_entries WHERE date BETWEEN $1 AND $2`;
  const params = [start, end];
  if (empParam) {
    params.push(empParam);
    query += ` AND employee_id = $${params.length}`;
  }
  query += ' GROUP BY employee_id, status';
  const rows = await all(query, params);

  const filteredEmployees = empParam ? employees.filter((e) => String(e.id) === String(empParam)) : employees;
  const data = buildCounts(rows, filteredEmployees).filter((r) => r.employee.active || r.total > 0);
  const maxTotal = Math.max(1, ...data.map((r) => r.total));

  const teamTotals = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]));
  let grandTotal = 0;
  for (const row of data) {
    for (const s of STATUS_ORDER) teamTotals[s] += row.counts[s];
    grandTotal += row.total;
  }

  const employeeOptions = employees
    .map((e) => `<option value="${e.id}" ${String(e.id) === empParam ? 'selected' : ''}>${esc(e.name)}</option>`)
    .join('');

  const tableRows = data
    .map(
      (row) => `<tr>
      <td class="row-head-cell">${esc(row.employee.name)}</td>
      ${STATUS_ORDER.map((s) => `<td class="num-cell">${row.counts[s] || ''}</td>`).join('')}
      <td class="num-cell total-cell">${row.total}</td>
      <td class="bar-cell">${barHtml(row, maxTotal)}</td>
    </tr>`
    )
    .join('');

  const html = layout({
    title: 'Reports',
    user: ctx.user,
    activePath: '/manager/reports',
    body: `
    <div class="page-head"><h1>Reports</h1></div>

    <div class="panel">
      <form method="GET" action="/manager/reports" class="form-row">
        <label class="field"><span>From</span><input type="date" name="start" value="${esc(start)}"></label>
        <label class="field"><span>To</span><input type="date" name="end" value="${esc(end)}"></label>
        <label class="field"><span>Employee</span>
          <select name="employee">
            <option value="">All employees</option>
            ${employeeOptions}
          </select>
        </label>
        <button class="btn btn-primary" type="submit">Update report</button>
      </form>
      <div class="quick-ranges">
        ${quickRangeLink('Month to date', defaults.start, defaults.end, empParam)}
      </div>
    </div>

    ${legendHtml()}

    ${
      data.length === 0
        ? `<div class="panel"><p class="muted">No schedule entries logged in this date range yet.</p></div>`
        : `<div class="table-scroll">
      <table class="data-table report-table">
        <thead>
          <tr>
            <th>Employee</th>
            ${STATUS_ORDER.map((s) => `<th class="num-cell">${STATUSES[s].icon} ${STATUSES[s].short}</th>`).join('')}
            <th class="num-cell">Total</th>
            <th>Breakdown</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
        <tfoot>
          <tr>
            <td class="row-head-cell">Team total</td>
            ${STATUS_ORDER.map((s) => `<td class="num-cell">${teamTotals[s] || ''}</td>`).join('')}
            <td class="num-cell total-cell">${grandTotal}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
    <p class="muted small">Range: ${esc(formatDisplayDate(start, { year: 'numeric' }))} – ${esc(
            formatDisplayDate(end, { year: 'numeric' })
          )}. Counts are number of days logged with each status.</p>`
    }
    `,
  });
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function quickRangeLink(label, start, end, empParam) {
  const qs = new URLSearchParams({ start, end, ...(empParam ? { employee: empParam } : {}) });
  return `<a class="btn btn-ghost btn-sm" href="/manager/reports?${qs.toString()}">${esc(label)}</a>`;
}

export function registerReportRoutes(router) {
  router.get('/manager/reports', requireRole(['MANAGER', 'ADMIN'], reportsHandler));
}
