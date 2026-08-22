import { all } from '../db.js';
import { createTeamAccessToken, clearTeamAccessCookie, setTeamAccessCookie, verifyTeamAccessCode } from '../auth.js';
import { teamLayout, layout, esc, redirect } from '../render.js';
import { readForm } from '../router.js';
import { requireTeamAccess } from '../middleware.js';
import { weekRange, todayStr, addDays, formatDisplayDate, weekdayLabel, isValidDateStr } from '../dateUtils.js';
import { STATUSES, STATUS_ORDER } from '../statuses.js';

function landingPage(error = '') {
  return layout({ title: 'Team access', user: null, body: `<div class="landing-shell"><section class="welcome-panel"><div class="eyebrow">DRVPV</div><h1>Welcome to UVC Team</h1><p class="landing-copy">Team schedule and tools, all in one place.</p>${error ? `<div class="flash flash-error">${esc(error)}</div>` : ''}<form method="POST" action="/team/access" class="access-form"><label class="field"><span>Shared access code</span><input type="password" name="code" required autofocus autocomplete="current-password" placeholder="Enter your team code"></label><button class="btn btn-primary btn-block" type="submit">Enter Team Portal <span aria-hidden="true">→</span></button></form><div class="admin-link"><span>Manager or administrator?</span><a href="/admin/login">Administrator Login</a></div></section><aside class="landing-art" aria-hidden="true"><div class="art-card art-card-sage"><span>This week</span><strong>Your team, at a glance.</strong></div><div class="art-card art-card-peach"><span>Simple & secure</span><strong>One welcoming place to stay aligned.</strong></div></aside></div>` });
}

async function schedulePage(req, res) {
  const url = new URL(req.url, 'http://x');
  const param = url.searchParams.get('week');
  const dates = weekRange(isValidDateStr(param) ? param : todayStr());
  const employees = await all('SELECT * FROM employees WHERE active = TRUE ORDER BY sort_order, name');
  const entries = employees.length ? await all(`SELECT * FROM schedule_entries WHERE employee_id = ANY($1::bigint[]) AND date = ANY($2::date[])`, [employees.map(e => e.id), dates]) : [];
  const map = new Map(entries.map(e => [`${e.employee_id}_${e.date}`, e]));
  const header = dates.map(d => `<th class="${d === todayStr() ? 'is-today' : ''}">${esc(weekdayLabel(d))}<span class="th-date">${esc(formatDisplayDate(d))}</span></th>`).join('');
  const rows = employees.map(emp => `<tr data-employee-name="${esc(emp.name.toLowerCase())}"><th class="row-head">${esc(emp.name)}${emp.title ? `<span class="row-sub">${esc(emp.title)}</span>` : ''}</th>${dates.map(d => { const e = map.get(`${emp.id}_${d}`); return `<td class="readonly-cell ${e ? `status-bg-${e.status}` : ''}">${e ? `<span class="schedule-status">${STATUSES[e.status].short}</span>${e.note ? `<span class="row-note">${esc(e.note)}</span>` : ''}` : '<span class="not-set">—</span>'}</td>`; }).join('')}</tr>`).join('');
  const prev = addDays(dates[0], -7), next = addDays(dates[0], 7);
  const body = `<div class="page-head schedule-heading"><div><p class="eyebrow">Full team schedule</p><h1>This Week</h1><p class="muted">${esc(formatDisplayDate(dates[0], {year:'numeric'}))} – ${esc(formatDisplayDate(dates[6], {year:'numeric'}))}</p></div><div class="week-nav"><a class="btn btn-ghost btn-sm" href="?week=${prev}">← Prev</a><a class="btn btn-ghost btn-sm" href="/team/schedule">Today</a><a class="btn btn-ghost btn-sm" href="?week=${next}">Next →</a></div></div><div class="schedule-toolbar"><label class="search-field"><span class="sr-only">Search employees</span><input id="employee-search" type="search" placeholder="Search team members…"></label><div class="legend">${STATUS_ORDER.map(k => `<span class="legend-item"><span class="dot status-dot-${k}"></span>${STATUSES[k].label}</span>`).join('')}</div></div>${employees.length ? `<div class="table-scroll team-grid-wrap"><table class="grid-table team-grid"><thead><tr><th class="row-head">Team member</th>${header}</tr></thead><tbody>${rows}</tbody></table></div><p class="muted small">Schedule is read only. Contact a manager if something needs updating.</p>` : '<div class="panel"><p class="muted">No active team members yet.</p></div>'}`;
  res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); res.end(teamLayout({title:'This Week', activePath:'/team/schedule', body}));
}

function toolsPage(req, res) {
  const body = `<div class="page-head"><div><p class="eyebrow">Team resources</p><h1>Tools & Calculators</h1><p class="muted">A home for the practical tools your team uses every day.</p></div></div><div class="tool-grid"><article class="tool-card tint-sage"><span class="tool-label">Coming soon</span><h2>Sales Calculator</h2><p>Quick planning and sales support tools will live here.</p></article><article class="tool-card tint-blue"><span class="tool-label">Coming soon</span><h2>Team Resources</h2><p>Useful links and shared references, organized in one place.</p></article><article class="tool-card tint-lavender"><span class="tool-label">Coming soon</span><h2>More tools</h2><p>Additional team utilities can be added without changing your workflow.</p></article></div>`;
  res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); res.end(teamLayout({title:'Tools & Calculators', activePath:'/team/tools', body}));
}

export function registerTeamRoutes(router) {
  router.get('/access', (req,res) => { res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); res.end(landingPage(new URL(req.url,'http://x').searchParams.get('error') || '')); });
  router.post('/team/access', async (req,res) => { const form = await readForm(req); if (!verifyTeamAccessCode(form.code || '')) return redirect(res, '/access?error=' + encodeURIComponent('That access code was not recognized. Please try again.')); const {token,expires}=createTeamAccessToken(); setTeamAccessCookie(res,token,expires); redirect(res,'/team'); });
  router.get('/team', requireTeamAccess((req,res) => redirect(res,'/team/schedule')));
  router.get('/team/schedule', requireTeamAccess(schedulePage));
  router.get('/team/tools', requireTeamAccess(toolsPage));
  router.post('/team/logout', (req,res) => { clearTeamAccessCookie(res); redirect(res,'/access'); });
}
