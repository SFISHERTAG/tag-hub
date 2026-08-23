-- Migration: per-lesson videos and reference docs
--
-- `course_subsections.loom_id` is one nullable varchar, and the player renders
-- it as one Loom iframe. That was true of the content the courses table was
-- seeded from and is not true of the legacy Skool trainings being imported in
-- story 12.4: lessons carry Fathom call recordings, Google Drive recordings,
-- and in one case 35 videos on a single lesson. Six more carry Google Doc or
-- Sheet reference links, which have no column at all today.
--
-- Child tables of course_subsections, following the precedent 007_courses.sql
-- set with course_checkboxes rather than inventing a second shape.
--
-- Videos and docs are two tables rather than one with a `kind` column. A video
-- needs a constrained provider and a provider-native id; a doc needs a free URL
-- and always a label. One table would make both halves nullable and enforce
-- neither.
--
-- loom_id stays. It is the fast path for the common single-Loom lesson, every
-- seeded row still uses it, and this migration deliberately backfills nothing:
-- the read path falls back to it when a subsection has no video rows.

CREATE TABLE IF NOT EXISTS course_subsection_videos (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  subsection_id VARCHAR NOT NULL REFERENCES course_subsections(id) ON DELETE CASCADE,
  provider VARCHAR NOT NULL CHECK (provider IN ('loom', 'fathom', 'drive')),
  external_id VARCHAR NOT NULL,
  -- Optional, e.g. a call-recording title. Deliberately not a prospect name:
  -- see story 12.4, labels are stripped to date-plus-generic before import.
  label VARCHAR,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS course_subsection_docs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  subsection_id VARCHAR NOT NULL REFERENCES course_subsections(id) ON DELETE CASCADE,
  label VARCHAR NOT NULL,
  url TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_subsection_videos_subsection
  ON course_subsection_videos(subsection_id, display_order);
CREATE INDEX IF NOT EXISTS idx_course_subsection_docs_subsection
  ON course_subsection_docs(subsection_id, display_order);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON course_subsection_videos, course_subsection_docs
  TO tag_app_user;
