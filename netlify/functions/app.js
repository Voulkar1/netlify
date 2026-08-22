import { createRouter } from '../../src/router.js';
import { parseCookies, getUserFromToken, verifyTeamAccessToken } from '../../src/auth.js';
import { homeFor, registerAuthRoutes } from '../../src/routes/auth.js';
import { registerScheduleRoutes } from '../../src/routes/schedule.js';
import { registerEmployeeRoutes } from '../../src/routes/employees.js';
import { registerReportRoutes } from '../../src/routes/reports.js';
import { registerNoteRoutes } from '../../src/routes/notes.js';
import { registerUserRoutes } from '../../src/routes/users.js';
import { registerTeamRoutes } from '../../src/routes/team.js';
import { runBootstrap } from '../../src/bootstrap.js';
import { FakeRes } from '../../src/fakeRes.js';

const router = createRouter();
registerAuthRoutes(router);
registerScheduleRoutes(router);
registerEmployeeRoutes(router);
registerReportRoutes(router);
registerNoteRoutes(router);
registerUserRoutes(router);
registerTeamRoutes(router);

export default async (req, _context) => {
  await runBootstrap();

  const url = new URL(req.url);
  const pathname = url.pathname;

  const cookies = parseCookies(req);
  const user = await getUserFromToken(cookies.session);
  const teamAccess = verifyTeamAccessToken(cookies.team_access);

  const res = new FakeRes();

  if (pathname === '/') {
    res.writeHead(302, { Location: user ? homeFor(user) : teamAccess ? '/team' : '/access' });
    res.end();
    return res.toResponse();
  }

  try {
    const handled = await router.handle(req, res, pathname, { user, teamAccess });
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
  path: '/*',
  // Netlify runs a function for every request matching `path`, even when a
  // static file exists at that URL — the default is function-wins, not
  // CDN-wins. Without `preferStatic`, this catch-all swallows /styles.css and
  // /app.js, the router has no route for them, and the browser gets the
  // router's own HTML 404 instead of the asset (an unstyled page).
  // `preferStatic` lets the CDN serve publish-directory files first and only
  // falls through to this function when no file matches.
  preferStatic: true,
};
