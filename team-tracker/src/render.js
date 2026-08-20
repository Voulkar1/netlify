export function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const NAV = {
  EMPLOYEE: [
    { href: '/schedule', label: 'My Schedule' },
    { href: '/notes', label: 'Team Notes' },
  ],
  MANAGER: [
    { href: '/manager/schedule', label: 'Schedule' },
    { href: '/manager/employees', label: 'Employees' },
    { href: '/manager/reports', label: 'Reports' },
    { href: '/notes', label: 'Notes' },
  ],
  ADMIN: [
    { href: '/manager/schedule', label: 'Schedule' },
    { href: '/manager/employees', label: 'Employees' },
    { href: '/manager/reports', label: 'Reports' },
    { href: '/notes', label: 'Notes' },
    { href: '/manager/users', label: 'User Accounts' },
  ],
};

export function layout({ title, user, activePath = '', body, flash = null }) {
  const navItems = user ? NAV[user.role] || [] : [];
  const navHtml = navItems
    .map(
      (item) =>
        `<a class="navlink${activePath.startsWith(item.href) ? ' active' : ''}" href="${item.href}">${esc(
          item.label
        )}</a>`
    )
    .join('');

  const flashHtml = flash
    ? `<div class="flash flash-${esc(flash.type || 'info')}">${esc(flash.message)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} · Team Tracker</title>
<link rel="stylesheet" href="/styles.css">
</head>
<body>
${
  user
    ? `<header class="topbar">
  <div class="topbar-inner">
    <a class="brand" href="/">Team Tracker</a>
    <nav class="nav">${navHtml}</nav>
    <div class="userbox">
      <span class="userinfo"><strong>${esc(user.name)}</strong> <span class="role-pill role-${esc(
        user.role
      )}">${esc(user.role)}</span></span>
      <form method="POST" action="/logout" class="inline-form">
        <button class="btn btn-ghost btn-sm" type="submit">Log out</button>
      </form>
    </div>
  </div>
</header>`
    : ''
}
<main class="page">
${flashHtml}
${body}
</main>
<script src="/app.js"></script>
</body>
</html>`;
}

export function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}
