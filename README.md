# Team Tracker

A schedule & attendance tracker for a small team: on-shift, off, holiday, MIA (missed/no-show),
and late — with role-based logins, a manager schedule editor, reports over a date range, and a
monthly notes board that automatically starts fresh each month.

Built to deploy on **Netlify**, using **Netlify DB** (a zero-config, auto-provisioned Postgres
database) for storage. There's no separate database to sign up for or connection string to
manage — it's created automatically the first time the site deploys. The app itself has a single
real dependency (`@netlify/database`); everything else — routing, HTML rendering, auth, sessions —
is plain Node.js.

## How it's structured

- `netlify/functions/app.js` — one serverless function that handles every request (login, the
  schedule grid, reports, notes, user management). Netlify routes all paths to it via the
  in-code `config.path = "/*"` at the bottom of that file.
- `public/` — static assets (`styles.css`, `app.js` for the schedule grid's autosave behavior),
  served directly by Netlify's CDN.
- `netlify/database/migrations/001_init/migration.sql` — the database schema. Netlify applies it
  automatically on deploy.
- `src/` — the actual application code (route handlers, HTML templates, auth, date/status
  helpers). This is shared between the Netlify function and `server.js`, a plain Node
  `http.createServer` entry point you can run locally (or on a non-Netlify host — see the note at
  the bottom).

## Local development

You can run the app locally with plain Node against any Postgres database — useful for testing
changes before deploying, or if you'd rather not use `netlify dev`.

```bash
cd team-tracker
npm install                 # installs @netlify/database
cp .env.example .env
# edit .env and set DATABASE_URL to a Postgres connection string
# (a free local Postgres, or a Neon/Supabase/etc. database both work)
psql "$DATABASE_URL" -f netlify/database/migrations/001_init/migration.sql
npm run seed                # creates demo accounts + sample data
npm start                   # http://localhost:3000
```

Alternatively, if you have the [Netlify CLI](https://cli.netlify.com) installed and the site
linked (`netlify link`), `netlify dev` will provision an isolated local database automatically and
apply migrations for you — no `DATABASE_URL` needed.

Demo logins (password for all: `ChangeMe123!`):

| Role     | Email                  |
|----------|------------------------|
| Admin    | admin@example.com      |
| Manager  | manager@example.com    |
| Employee | ana@example.com        |
| Employee | luis@example.com       |
| Employee | priya@example.com      |
| Employee | marco@example.com      |
| Employee | sofia@example.com      |

**Change or remove these before giving anyone else access.** The Admin account can create fresh
logins and reset passwords from **User Accounts**; deactivate the demo employees from
**Employees** once you've added your real team.

## Deploying to Netlify

### Team portal access

Set `TEAM_ACCESS_CODE` to the shared code distributed to employees and set `TEAM_ACCESS_SECRET`
to a long, random value used to sign the seven-day team-access cookie. Neither value is sent to
the browser or stored in the repository. General employees enter through `/access`; existing
manager and administrator email/password authentication remains available at `/admin/login`.
No database migration is required for team access.

1. Push this folder to a GitHub (or GitLab) repository — Netlify builds from a connected repo.
2. In the Netlify dashboard: **Add new site** → **Import an existing project**, and point it at
   that repo. Netlify reads `netlify.toml` (publish directory, functions directory) automatically.
3. On the first deploy, installing `@netlify/database` provisions a Postgres database for the
   site automatically and applies the migration in `netlify/database/migrations/`. No connection
   string to configure.
4. In the site's environment variables, set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD`
   *before* that first deploy — the app creates that one real Admin account automatically on first
   boot if the database is empty (see `src/bootstrap.js`). You can remove those two variables
   after your first login; they only do anything when there are zero users in the database.
5. Once it's live, log in as that Admin and use **User Accounts** / **Employees** to create real
   Manager and Employee logins — or run `npm run seed` against the site's database instead, if you
   want the demo data to explore the app first (see "Local development" above for how to point at
   a specific database).

Deploy previews and branch deploys each get their own isolated copy of the database (seeded from
production on first use), so you can safely test changes without touching real schedule data.

## Roles

- **Employee** — signs in and sees *My Schedule* (their own week, with Prev/Next navigation) and
  the current month's *Team Notes* (read-only).
- **Manager** — edits the team schedule grid, adds/removes/deactivates employees, creates employee
  logins, runs reports over any date range, and posts/deletes notes for the current month.
- **Admin** — everything a Manager can do, plus creating and managing *any* login (Admin, Manager,
  or Employee accounts) under **User Accounts**.

Deactivating an employee (instead of deleting) keeps their historical schedule data intact for
reports, while removing them from the active weekly grid.

## How the pieces work

- **Schedule** — each employee/day has one status: On Shift, Day Off, Holiday, Late, or MIA, plus
  an optional short note (e.g. "left at 2pm", "covering for Luis"). Managers edit the grid at
  `/manager/schedule`; changes save automatically per cell (no separate "Save" button/page reload).
- **Reports** — `/manager/reports` lets a manager pick a date range (and optionally a single
  employee) and see a count of each status per employee, team totals, and a simple bar breakdown.
  Counts reflect days that actually have a status logged in that range.
- **Monthly notes** — `/notes` shows notes for the *current* month only, and the "add note" form
  only appears while viewing the current month. When the calendar rolls into a new month, the
  board is simply empty again — nothing to manually clear. Past months aren't deleted; they're
  available read-only from the month dropdown at the top of the page, in case you need to look
  something up later. (If you'd rather notes truly disappear forever after each month, that's a
  small change in `src/routes/notes.js` — ask your developer, or ask Claude, to wire up a delete-old
  routine instead of the archive view.)

## Project layout

```
netlify.toml                        Netlify build/functions config
netlify/
  functions/app.js                  The one serverless function (routes every request)
  database/migrations/001_init/     Postgres schema, applied automatically on deploy
server.js                           Plain Node entry point for local/non-Netlify use
src/
  db.js                              Postgres query helpers (via @netlify/database)
  auth.js                            Password hashing, sessions, cookies
  bootstrap.js                       Creates the first Admin account on a fresh database
  config.js                          Loads .env (non-Netlify use only)
  dateUtils.js                       Week/month date helpers (timezone-aware)
  statuses.js                        The 5 status types, labels, and colors
  render.js                          Shared HTML layout/nav
  router.js                          Minimal request router (no framework)
  middleware.js                      Role-based access checks
  fakeRes.js                         Adapts route handlers to the Netlify Function's Request/Response
  routes/
    auth.js         Login / logout
    schedule.js      Employee week view + manager grid + save API
    employees.js      Manager: add/edit/deactivate employees, create logins
    reports.js          Date-range reports
    notes.js              Monthly notes board
    users.js                Admin: manage all login accounts
public/
  styles.css       All app styling (no CSS framework)
  app.js            Auto-save behavior for the schedule grid
scripts/
  seed.js         Creates demo accounts, employees, and sample data
```

## A few things worth doing before a real rollout

1. Set a real `SESSION_SECRET` if running outside Netlify (reserved for future use — sessions are
   random opaque tokens stored in the database, not signed, but keep it private regardless).
2. Set `APP_TZ` to your team's timezone (defaults to `America/Mexico_City`) so "today" and week
   boundaries land correctly. On Netlify, set this as a site environment variable.
3. `COOKIE_SECURE` — Netlify serves everything over HTTPS by default, so set this to `true` as a
   site environment variable.
4. If your team grows large enough that a single small Postgres instance is a concern (this is a
   high bar — thousands of employees, not dozens), Netlify DB scales like any managed Postgres;
   nothing in the app needs to change.

## Running this somewhere other than Netlify

`server.js` runs the same application code with plain `node` against any Postgres database (set
`DATABASE_URL`) — useful for a VPS, Render, Railway, or similar "run a Node app" host. The one
Netlify-specific piece is the `@netlify/database` import in `src/db.js`, which just wraps
`getDatabase({ connectionString })` — a thin call you'd swap for the plain `pg` package's
`new pg.Pool({ connectionString })` (same `.query(text, params)` interface) if deploying somewhere
without Netlify's automatic provisioning. Everything else — routes, auth, rendering — is
unchanged either way.
