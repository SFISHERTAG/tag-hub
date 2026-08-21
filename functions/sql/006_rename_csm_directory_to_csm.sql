-- Migration: reconcile csm_directory -> csm. Idempotent, safe on any database.
--
-- Two sessions built the same table (CS org reporting lines, Firestore
-- collection `csm/{email}`) under two names: 004 as `csm_directory`, and a
-- parallel edit to 003 as `csm`. We consolidate on `csm`, which matches the
-- source Firestore collection name 1:1.
--
-- This file used to be a bare
--   ALTER TABLE IF EXISTS csm_directory RENAME TO csm;
-- which only worked on the one database it was written against: the legacy
-- one, where 003 predated its own `csm` block and so only `csm_directory`
-- existed. On any database built from the current files, 003 creates `csm`
-- and 004 creates `csm_directory`, so the rename finds its destination
-- already taken and fails with `relation "csm" already exists`. IF EXISTS
-- guards the source, never the target.
--
-- 004 is left as it is rather than neutered. It has already run against the
-- production database, and rewriting an applied migration hides the history
-- instead of resolving it. This file is the reconciler, and it is written to
-- converge from either starting shape however many times it runs.

DO $$
BEGIN
  IF to_regclass('public.csm_directory') IS NULL THEN
    -- Already reconciled, or never split. Nothing to do.
    RETURN;
  END IF;

  IF to_regclass('public.csm') IS NULL THEN
    -- Legacy path: `csm` was never created, so the rename is the whole job.
    -- A rename carries the table's grants, constraints and data with it.
    ALTER TABLE csm_directory RENAME TO csm;
    ALTER INDEX IF EXISTS idx_csm_directory_manager RENAME TO idx_csm_manager_email;
    RETURN;
  END IF;

  -- Both tables exist. Fold csm_directory's rows into csm, then drop it.
  --
  -- Two passes, because csm.manager_email is a self-referencing foreign key
  -- and is not deferrable: a single INSERT would fail whenever a row landed
  -- ahead of its own manager. Pass one inserts the identities with no manager
  -- set, pass two fills the reporting lines in once every row is present.
  -- Rows already in `csm` win on conflict. This migration reconciles a naming
  -- split; it does not overwrite live data.
  INSERT INTO csm (email, role, manager_email)
  SELECT email, role, NULL FROM csm_directory
  ON CONFLICT (email) DO NOTHING;

  UPDATE csm c
     SET manager_email = d.manager_email
    FROM csm_directory d
   WHERE c.email = d.email
     AND c.manager_email IS NULL
     AND d.manager_email IS NOT NULL
     AND EXISTS (SELECT 1 FROM csm m WHERE m.email = d.manager_email);

  DROP TABLE csm_directory;  -- takes idx_csm_directory_manager with it
END
$$;

-- Both paths converge here. The index and the grant are asserted rather than
-- assumed, so a database that arrived by either route ends up identical.
CREATE INDEX IF NOT EXISTS idx_csm_manager_email ON csm (manager_email);
GRANT SELECT, INSERT, UPDATE, DELETE ON csm TO tag_app_user;
