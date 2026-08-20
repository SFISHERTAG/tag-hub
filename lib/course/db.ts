import "server-only";
import { pool } from "@/lib/postgres";
import type { Course, Section, Subsection, Checkbox } from "./types";

/**
 * Row shapes as the SELECTs above actually return them: snake_case columns,
 * nullable where the schema allows it. Named rather than left as `any` so a
 * column rename breaks here instead of producing `undefined` in the UI.
 */
type SubsectionRow = { id: string; title: string; loom_id: string | null; content: string };
type SectionRow = { id: string; title: string };
type CourseRow = { id: string; slug: string; title: string; description: string | null };

/**
 * Course content, in Postgres.
 *
 * Was a hand-edited static Record<string, Course> — every content change
 * meant a code change and a deploy. Admin editing (app/admin/courses)
 * needs a real write path, so this replaced the static file rather than
 * sitting alongside it: one source of truth, not two that can drift.
 */

async function getCheckboxes(subsectionId: string): Promise<Checkbox[]> {
  const result = await pool.query(
    "SELECT id, label FROM course_checkboxes WHERE subsection_id = $1 ORDER BY display_order",
    [subsectionId],
  );
  return result.rows;
}

async function getSubsections(sectionId: string): Promise<Subsection[]> {
  const result = await pool.query(
    "SELECT id, title, loom_id, content FROM course_subsections WHERE section_id = $1 ORDER BY display_order",
    [sectionId],
  );

  return Promise.all(
    result.rows.map(async (row: SubsectionRow) => ({
      id: row.id,
      title: row.title,
      loomId: row.loom_id ?? undefined,
      content: row.content,
      checkboxes: await getCheckboxes(row.id),
    })),
  );
}

async function getSections(courseId: string): Promise<Section[]> {
  const result = await pool.query(
    "SELECT id, title FROM course_sections WHERE course_id = $1 ORDER BY display_order",
    [courseId],
  );

  return Promise.all(
    result.rows.map(async (row: SectionRow) => ({
      id: row.id,
      title: row.title,
      subsections: await getSubsections(row.id),
    })),
  );
}

export async function getCourse(slugOrId: string): Promise<Course | undefined> {
  const result = await pool.query(
    "SELECT id, slug, title, description FROM courses WHERE slug = $1 OR id = $1 LIMIT 1",
    [slugOrId],
  );
  if (result.rows.length === 0) return undefined;

  const row = result.rows[0];
  return {
    id: row.slug,
    title: row.title,
    description: row.description,
    sections: await getSections(row.id),
  };
}

export async function getAllCourses(): Promise<Course[]> {
  const result = await pool.query("SELECT id, slug, title, description FROM courses ORDER BY display_order");

  return Promise.all(
    result.rows.map(async (row: CourseRow) => ({
      id: row.slug,
      title: row.title,
      // The column is nullable; Course.description is not.
      description: row.description ?? "",
      sections: await getSections(row.id),
    })),
  );
}

// ─── Admin write path ───────────────────────────────────────────────────

export type CourseSummary = { id: string; slug: string; title: string; description: string };

export async function listCourseSummaries(): Promise<CourseSummary[]> {
  const result = await pool.query(
    "SELECT id, slug, title, description FROM courses ORDER BY display_order",
  );
  return result.rows;
}

/** Internal (row) id, not the slug — admin editing operates on the real course row. */
export async function getCourseById(id: string): Promise<Course | undefined> {
  const result = await pool.query(
    "SELECT id, slug, title, description FROM courses WHERE id = $1",
    [id],
  );
  if (result.rows.length === 0) return undefined;

  const row = result.rows[0];
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    sections: await getSections(row.id),
  };
}

export async function updateCourseMeta(
  id: string,
  fields: { title: string; description: string },
): Promise<void> {
  await pool.query(
    "UPDATE courses SET title = $2, description = $3, updated_at = now() WHERE id = $1",
    [id, fields.title, fields.description],
  );
}

export async function createSection(courseId: string, title: string): Promise<string> {
  const count = await pool.query(
    "SELECT COUNT(*)::int AS n FROM course_sections WHERE course_id = $1",
    [courseId],
  );
  const result = await pool.query(
    "INSERT INTO course_sections (course_id, title, display_order) VALUES ($1, $2, $3) RETURNING id",
    [courseId, title, count.rows[0].n],
  );
  return result.rows[0].id;
}

export async function updateSection(id: string, title: string): Promise<void> {
  await pool.query(
    "UPDATE course_sections SET title = $2, updated_at = now() WHERE id = $1",
    [id, title],
  );
}

export async function deleteSection(id: string): Promise<void> {
  await pool.query("DELETE FROM course_sections WHERE id = $1", [id]);
}

export async function createSubsection(
  sectionId: string,
  fields: { title: string; loomId?: string; content: string },
): Promise<string> {
  const count = await pool.query(
    "SELECT COUNT(*)::int AS n FROM course_subsections WHERE section_id = $1",
    [sectionId],
  );
  const result = await pool.query(
    `INSERT INTO course_subsections (section_id, title, loom_id, content, display_order)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [sectionId, fields.title, fields.loomId || null, fields.content, count.rows[0].n],
  );
  return result.rows[0].id;
}

export async function updateSubsection(
  id: string,
  fields: { title: string; loomId?: string; content: string },
): Promise<void> {
  await pool.query(
    `UPDATE course_subsections SET title = $2, loom_id = $3, content = $4, updated_at = now() WHERE id = $1`,
    [id, fields.title, fields.loomId || null, fields.content],
  );
}

export async function deleteSubsection(id: string): Promise<void> {
  await pool.query("DELETE FROM course_subsections WHERE id = $1", [id]);
}

export async function createCheckbox(subsectionId: string, label: string): Promise<string> {
  const count = await pool.query(
    "SELECT COUNT(*)::int AS n FROM course_checkboxes WHERE subsection_id = $1",
    [subsectionId],
  );
  const result = await pool.query(
    "INSERT INTO course_checkboxes (subsection_id, label, display_order) VALUES ($1, $2, $3) RETURNING id",
    [subsectionId, label, count.rows[0].n],
  );
  return result.rows[0].id;
}

export async function updateCheckbox(id: string, label: string): Promise<void> {
  await pool.query("UPDATE course_checkboxes SET label = $2 WHERE id = $1", [id, label]);
}

export async function deleteCheckbox(id: string): Promise<void> {
  await pool.query("DELETE FROM course_checkboxes WHERE id = $1", [id]);
}
