-- ---------------------------------------------------------------------
-- Story 11.6 — course progress is now live on Postgres.
--
-- The table itself is created by 003 (line 258) and is covered by that
-- file's blanket GRANT at line 289, which runs after it. Verified rather
-- than re-granted here: a redundant GRANT would imply the earlier one
-- missed it, and the next person would have to re-derive that it did not.
--
-- What is new is that anything reads it. getCourseCompletionRates groups
-- by uid within one course, and the primary key leads with uid, so it is
-- no use for that access path. This index is what keeps the aggregate a
-- lookup instead of a full scan once real progress accumulates.
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS course_progress_course_id_idx
  ON course_progress (course_id);
