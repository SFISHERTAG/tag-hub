-- Migration: csm_directory table
-- Was Firestore: csm/{email} (see hub/lib/dashboard/csm-directory.ts)
--
-- CS org reporting lines. clients.csm_assigned says which CSM owns a
-- client; this says who that CSM reports to. A CSD's department rollup and
-- a CSM's own-book scope both read from it. Keyed by email to match
-- clients.csm_assigned's existing free-text-email convention.
--
-- Added after 003 rather than folded into it: this table belongs to
-- in-flight CSD/rollup feature work happening in a parallel session, and
-- keeping it as its own numbered migration avoids editing a file another
-- session might also be extending.

CREATE TABLE IF NOT EXISTS csm_directory (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('csm', 'csd', 'exec')),
  manager_email TEXT REFERENCES csm_directory(email)
);

-- Was: where("managerEmail","==",csdEmail) -- a CSD's team lookup.
CREATE INDEX IF NOT EXISTS idx_csm_directory_manager ON csm_directory (manager_email);

GRANT SELECT, INSERT, UPDATE, DELETE ON csm_directory TO tag_app_user;
