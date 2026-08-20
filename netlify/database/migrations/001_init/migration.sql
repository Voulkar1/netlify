-- Initial schema for Team Tracker. Applied automatically by Netlify on deploy.

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  title TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN','MANAGER','EMPLOYEE')),
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schedule_entries (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date TEXT NOT NULL, -- 'YYYY-MM-DD', kept as text (not DATE) so it round-trips as a
                       -- plain string through any Postgres driver, matching how the
                       -- app compares/keys dates elsewhere (no driver-specific
                       -- Date-object coercion to worry about).
  status TEXT NOT NULL CHECK (status IN ('ON','OFF','HOLIDAY','MIA','LATE')),
  start_time TEXT,
  end_time TEXT,
  note TEXT,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

CREATE TABLE IF NOT EXISTS monthly_notes (
  id SERIAL PRIMARY KEY,
  month TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_date ON schedule_entries(date);
CREATE INDEX IF NOT EXISTS idx_schedule_employee ON schedule_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_notes_month ON monthly_notes(month);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
