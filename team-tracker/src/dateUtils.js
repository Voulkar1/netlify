import { config } from './config.js';

// Format a Date as YYYY-MM-DD in the configured app timezone.
export function toDateStr(date, tz = config.appTz) {
  // en-CA locale formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function todayStr() {
  return toDateStr(new Date());
}

export function currentMonthKey() {
  return todayStr().slice(0, 7); // YYYY-MM
}

export function monthKeyOf(dateStr) {
  return dateStr.slice(0, 7);
}

// Parse a YYYY-MM-DD string into a UTC-noon Date (avoids DST/timezone edge issues
// when doing day-level arithmetic).
export function parseDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function addDays(dateStr, n) {
  const d = parseDateStr(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return toDateStr(d, 'UTC');
}

// ISO weekday: 1=Monday .. 7=Sunday
export function isoWeekday(dateStr) {
  const d = parseDateStr(dateStr);
  const wd = d.getUTCDay(); // 0=Sun..6=Sat
  return wd === 0 ? 7 : wd;
}

// Returns the Monday..Sunday array of date strings for the week containing dateStr.
export function weekRange(dateStr) {
  const wd = isoWeekday(dateStr);
  const monday = addDays(dateStr, 1 - wd);
  const days = [];
  for (let i = 0; i < 7; i++) days.push(addDays(monday, i));
  return days;
}

export function formatDisplayDate(dateStr, opts = {}) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    ...opts,
  }).format(parseDateStr(dateStr));
}

export function weekdayLabel(dateStr) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' }).format(
    parseDateStr(dateStr)
  );
}

export function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1, 12));
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(d);
}

export function isValidDateStr(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
