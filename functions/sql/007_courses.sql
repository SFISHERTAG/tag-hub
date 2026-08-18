-- Migration: courses schema
--
-- Was a static Record<string, Course> in lib/course/data.ts (one course,
-- "Onboarding & Expectations", hand-edited in code). Admin needs to edit
-- this without a deploy, so it moves to Postgres.
--
-- UUID surrogate keys, not the slug-style ids the static file used
-- ("onboarding", "welcome") — those were only ever unique within one
-- hardcoded course. Mirrors flow_frameworks/flow_tabs/flow_sections'
-- shape (functions/sql, sql/flow-schema.sql) for the same reason: slugs
-- collide once more than one course/section can be created by hand.

CREATE TABLE IF NOT EXISTS courses (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS course_sections (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id VARCHAR NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS course_subsections (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id VARCHAR NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  loom_id VARCHAR,
  content TEXT NOT NULL DEFAULT '',
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS course_checkboxes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  subsection_id VARCHAR NOT NULL REFERENCES course_subsections(id) ON DELETE CASCADE,
  label VARCHAR(255) NOT NULL,
  display_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_course_sections_course ON course_sections(course_id, display_order);
CREATE INDEX IF NOT EXISTS idx_course_subsections_section ON course_subsections(section_id, display_order);
CREATE INDEX IF NOT EXISTS idx_course_checkboxes_subsection ON course_checkboxes(subsection_id, display_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON courses, course_sections, course_subsections, course_checkboxes TO tag_app_user;
