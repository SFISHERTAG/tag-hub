-- Migration: rename csm_directory -> csm
--
-- 004_csm_directory.sql and a parallel session's edit to 003 independently
-- built the same table (CS org reporting lines, Firestore collection
-- `csm/{email}`) under two names. Consolidating on `csm` — it matches the
-- source Firestore collection name 1:1, which the other name didn't.
--
-- After this runs, 003's own (redundant) `CREATE TABLE IF NOT EXISTS csm`
-- block no-ops cleanly against the renamed table, regardless of which
-- migration file runs first from here on.

ALTER TABLE IF EXISTS csm_directory RENAME TO csm;
ALTER INDEX IF EXISTS idx_csm_directory_manager RENAME TO idx_csm_manager_email;
