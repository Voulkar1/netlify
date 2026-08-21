import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { config } from './src/config.js';
import { createRouter } from './src/router.js';
import { parseCookies, getUserFromToken, verifyTeamAccessToken } from './src/auth.js';
import { homeFor, registerAuthRoutes } from './src/routes/auth.js';
import { registerScheduleRoutes } from './src/routes/schedule.js';
import { registerEmployeeRoutes } from './src/routes/employees.js';
import { registerReportRoutes } from './src/routes/reports.js';
import { registerNoteRoutes } from './src/routes/notes.js';
import { registerUserRoutes } from './src/routes/users.js';
import { registerTeamRoutes } from './src/routes/team.js';
import { redirect } from './src/render.js';
import { runBootstrap } from './src/bootstrap.js';

await runBootstrap();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const router = createRouter();
registerAuthRoutes(router);
registerScheduleRoutes(router);
registerEmployeeRoutes(router);
registerReportRoutes(router);
registerNoteRoutes(router);
registerUserRoutes(router);
registerTeamRoutes(router);

async function serveStatic(req, res, pathname) {
  const safeSuffix = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(publicDir, safeSuffix);
  if (!filePath.startsWith(publicDir)) return false;
  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname !== '/' && (await serveStatic(req, res, pathname))) return;

    const cookies = parseCookies(req);
    const user = await getUserFromToken(cookies.session);
    const teamAccess = verifyTeamAccessToken(cookies.team_access);

    if (pathname === '/') {
      return redirect(res, user ? homeFor(user) : teamAccess ? '/team' : '/access');
    }

    const handled = await router.handle(req, res, pathname, { user, teamAccess });
    if (!handled) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 — Not found</h1><p><a href="/">Go home</a></p>');
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>500 — Something went wrong</h1>');
    } else {
      res.end();
    }
  }
});

server.listen(config.port, () => {
  console.log(`Team Tracker running at http://localhost:${config.port}`);
});
