-- ---------------------------------------------------------------------
-- Story 15.0 — a ledger of which migrations have been applied.
--
-- There is no migration runner. docs/RESWEEP_DEPLOY_RUNBOOK.md says so and
-- cloudbuild.yaml has no SQL step: these files are hand-applied through
-- psql and until now nothing recorded which ones had run. Correctness
-- depended on someone remembering.
--
-- It has already failed once. 006 assumed it ran before 003 and failed on
-- every clean sequential deploy with `relation "csm" already exists`. That
-- file was made idempotent, which fixed the file and not the absence
-- underneath it. Epic 15 adds two more migrations and Epic 14 adds one per
-- collection, so the pile nobody is counting is about to grow.
--
-- The checksum is the part that earns its keep. Knowing 006 ran is mildly
-- useful; knowing 006 ran and has been edited since is what would have
-- caught the incident.
--
-- Idempotent, and safe on a fresh database and on the live one, per the
-- standing rule in docs/data-model.md.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename    TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- sha256 of the file's bytes, hex. Nullable only for the backfill below,
  -- which asserts history it cannot verify; see the comment there.
  checksum    TEXT
);

-- Its own GRANT. 003's blanket grant only covered tables that existed when
-- it ran, so a table added afterwards works on a fresh sequential deploy
-- and fails on the real database — the harder of the two to notice.
GRANT SELECT, INSERT, UPDATE, DELETE ON schema_migrations TO tag_app_user;

-- ---------------------------------------------------------------------
-- Backfill 001-010.
--
-- These are applied in production. Recording them is an assertion about
-- history, not a discovery: nothing here can verify that 004 actually ran,
-- only that it is expected to have. The checksum is left NULL for exactly
-- that reason — a value invented now would look like evidence.
-- scripts/check-migrations.mjs reports a NULL checksum as unverified
-- rather than as agreement.
--
-- ON CONFLICT DO NOTHING so re-running never overwrites a real applied_at
-- or a checksum a later run recorded properly.
-- ---------------------------------------------------------------------
INSERT INTO schema_migrations (filename, checksum) VALUES
  ('001_create_automation_logs.sql',        NULL),
  ('002_create_dashboard_configs.sql',      NULL),
  ('003_migrate_firestore_to_postgres.sql', NULL),
  ('004_csm_directory.sql',                 NULL),
  ('005_clients_upsell_and_audit_index.sql',NULL),
  ('006_rename_csm_directory_to_csm.sql',   NULL),
  ('007_courses.sql',                       NULL),
  ('008_course_subsection_media.sql',       NULL),
  ('009_course_visibility.sql',             NULL),
  ('010_course_progress_reporting.sql',     NULL)
ON CONFLICT (filename) DO NOTHING;

-- And this file itself, so the ledger is complete the moment it exists.
INSERT INTO schema_migrations (filename, checksum) VALUES
  ('011_schema_migrations.sql', NULL)
ON CONFLICT (filename) DO NOTHING;
