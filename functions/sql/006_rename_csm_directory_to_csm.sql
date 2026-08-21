-- Migration: consolidate csm_directory -> csm
--
-- 004_csm_directory.sql and a parallel session's edit to 003 independently
-- built the same table (CS org reporting lines, Firestore collection
-- `csm/{email}`) under two names. Consolidating on `csm` — it matches the
-- source Firestore collection name 1:1, which the other name didn't.
--
-- This file previously ran a bare `ALTER TABLE ... RENAME TO csm`, on the
-- assumption that 003's own `CREATE TABLE IF NOT EXISTS csm` would run after
-- it. Run in file order, which is how a fresh deploy runs them, 003 creates
-- `csm` first and the rename then fails outright with `relation "csm"
-- already exists` — so every clean deploy of this database stopped here. The
-- same collision applied to the index rename.
--
-- Written so both histories converge on the same result, and so re-running it
-- is a no-op:
--
--   only csm_directory exists  -> rename it (the original intent)
--   both exist                 -> copy any rows csm is missing, drop the dup
--   only csm exists            -> nothing to do
--
-- The row copy matters for the second case: on a fresh deploy both tables are
-- empty and it is a no-op, but on a database where 004 was populated before
-- 003's block was added, dropping csm_directory without it would delete real
-- reporting lines.

DO $$
BEGIN
  IF to_regclass('public.csm_directory') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public.csm') IS NULL THEN
    ALTER TABLE csm_directory RENAME TO csm;
  ELSE
    INSERT INTO csm (email, role, manager_email)
      SELECT email, role, manager_email FROM csm_directory
      ON CONFLICT (email) DO NOTHING;
    DROP TABLE csm_directory;
  END IF;
END
$$;

-- Same shape for the index: rename only when the target name is free,
-- otherwise the old one is redundant and goes.
DO $$
BEGIN
  IF to_regclass('public.idx_csm_directory_manager') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public.idx_csm_manager_email') IS NULL THEN
    ALTER INDEX idx_csm_directory_manager RENAME TO idx_csm_manager_email;
  ELSE
    DROP INDEX idx_csm_directory_manager;
  END IF;
END
$$;
