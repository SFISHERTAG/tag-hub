-- Migration: hat-scoped course and lesson visibility
--
-- Training was visible to every signed-in user: `GET /api/courses` called
-- `requireApiSession()` and nothing further, which was correct while the only
-- courses were client-facing onboarding and sales material.
--
-- Story 12.4 imports two internal trainings alongside them. The CSM course
-- carries internal process and pricing, and the Internal Sales Rep course
-- carries recordings of real client calls. Neither belongs in a client's
-- course list, so visibility becomes per-course and, for one lesson, per-lesson.
--
-- An empty array means "everyone signed in", which is what every existing row
-- gets by default. That keeps this migration a no-op for the seeded courses
-- rather than a silent removal of access, and it means a course created through
-- the admin editor is visible until someone deliberately restricts it — the
-- failure direction the audit's fail-closed field catalog got wrong in the
-- other direction, where six roles resolved to an empty allowlist and saw
-- nothing at all.
--
-- Role strings are constrained by the app, not the database: lib/auth/roles.ts
-- is the single definition and a CHECK here would be a second one to keep in
-- sync. The import and the API both write through that module.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS visible_to_roles VARCHAR[] NOT NULL DEFAULT '{}';

ALTER TABLE course_subsections
  ADD COLUMN IF NOT EXISTS visible_to_roles VARCHAR[] NOT NULL DEFAULT '{}';
