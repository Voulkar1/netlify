import { createRouter } from '../../src/router.js';
import { parseCookies, getUserFromToken } from '../../src/auth.js';
import { homeFor, registerAuthRoutes } from '../../src/routes/auth.js';
import { registerScheduleRoutes } from '../../src/routes/schedule.js';
import { registerEmployeeRoutes } from '../../src/routes/employees.js';
import { registerReportRoutes } from '../../src/routes/reports.js';
import { registerNoteRoutes } from '../../src/routes/notes.js';
import { registerUserRoutes } from '../../src/routes/users.js';
import { runBootstrap } from '../../src/bootstrap.js';
import { FakeRes } from '../../src/fakeRes.js';

const router = createRouter();
registerAuthRoutes(router);
registerScheduleRoutes(router);
registerEmployeeRoutes(router);
registerReportRoutes(router);
registerNoteRoutes(router);
registerUserRoutes(router);

export default async (req, _context) => {
  await runBootstrap();

  const url = new URL(req.url);
  const pathname = url.pathname;

  const cookies = parseCookies(req);
  const user = await getUserFromToken(cookies.session);

  const res = new FakeRes();

  if (pathname === '/') {
    res.writeHead(302, { Location: homeFor(user) });
    res.end();
    return res.toResponse();
  }

  try {
    const handled = await router.handle(req, res, pathname, { user });
    if (!handled) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 — Not found</h1><p><a href="/">Go home</a></p>');
    }
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>500 — Something went wrong</h1>');
  }

  return res.toResponse();
};

export const config = {
  // Static files in /public (styles.css, app.js) are served directly by
  // Netlify's CDN and take precedence over this catch-all function route.
  path: '/*',
};
