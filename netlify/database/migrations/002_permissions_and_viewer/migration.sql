-- Adds per-account permission flags (view reports / edit schedule), a new
-- VIEWER role for the generic read-only team-calendar access code, and a
-- small key/value settings table to hold that access code.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS can_view_reports BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS can_edit_schedule BOOLEAN NOT NULL DEFAULT TRUE;

-- Widen the role check to allow 'VIEWER' (a single shared, read-only
-- account used by the generic team-calendar access code).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('ADMIN','MANAGER','EMPLOYEE','VIEWER'));

-- Generic app-wide settings (currently just the viewer access code). Stored
-- as plain text deliberately — this is a low-stakes, shared/shareable code
-- for a read-only view, not an individual credential, and an Admin needs to
-- be able to look it up again later, not just reset it blind.
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
