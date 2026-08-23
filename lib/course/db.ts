import "server-only";
import { pool } from "@/lib/postgres";
import type {
  Course,
  Section,
  Subsection,
  Checkbox,
  SubsectionDoc,
  SubsectionVideo,
  VideoProvider,
} from "./types";

/**
 * Row shapes as the SELECTs above actually return them: snake_case columns,
 * nullable where the schema allows it. Named rather than left as `any` so a
 * column rename breaks here instead of producing `undefined` in the UI.
 */
type SubsectionRow = {
  id: string;
  title: string;
  loom_id: string | null;
  content: string;
  visible_to_roles: string[] | null;
};
type SectionRow = { id: string; title: string };
type CourseRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  visible_to_roles: string[] | null;
};
type CheckboxRow = { id: string; label: string; subsection_id: string };
type VideoRow = {
  id: string;
  subsection_id: string;
  provider: VideoProvider;
  external_id: string;
  label: string | null;
};
type DocRow = { id: string; subsection_id: string; label: string; url: string };

/**
 * Course content, in Postgres.
 *
 * Was a hand-edited static Record<string, Course> — every content change
 * meant a code change and a deploy. Admin editing (app/admin/courses)
 * needs a real write path, so this replaced the static file rather than
 * sitting alongside it: one source of truth, not two that can drift.
 */

/** Groups child rows by their `subsection_id`, preserving each query's ORDER BY. */
function groupBySubsection<Row extends { subsection_id: string }, Mapped>(
  rows: Row[],
  map: (row: Row) => Mapped,
): Map<string, Mapped[]> {
  const grouped = new Map<string, Mapped[]>();
  for (const row of rows) {
    const existing = grouped.get(row.subsection_id);
    if (existing) {
      existing.push(map(row));
    } else {
      grouped.set(row.subsection_id, [map(row)]);
    }
  }
  return grouped;
}

/**
 * One section's lessons, with their checklist, videos and reference docs.
 *
 * Three child queries for the whole section rather than three per lesson. The
 * previous shape issued one checkbox query per subsection, and adding videos
 * and docs the same way would have tripled a waterfall the audit already
 * flagged on FLOW. `= ANY($1)` keeps this at four round trips per section no
 * matter how many lessons it holds.
 */
async function getSubsections(sectionId: string): Promise<Subsection[]> {
  const result = await pool.query(
    `SELECT id, title, loom_id, content, visible_to_roles FROM course_subsections
     WHERE section_id = $1 ORDER BY display_order`,
    [sectionId],
  );

  const subsectionIds = result.rows.map((row: SubsectionRow) => row.id);
  if (subsectionIds.length === 0) return [];

  const [checkboxes, videos, docs] = await Promise.all([
    pool.query(
      `SELECT id, label, subsection_id FROM course_checkboxes
       WHERE subsection_id = ANY($1) ORDER BY display_order`,
      [subsectionIds],
    ),
    pool.query(
      `SELECT id, subsection_id, provider, external_id, label FROM course_subsection_videos
       WHERE subsection_id = ANY($1) ORDER BY display_order`,
      [subsectionIds],
    ),
    pool.query(
      `SELECT id, subsection_id, label, url FROM course_subsection_docs
       WHERE subsection_id = ANY($1) ORDER BY display_order`,
      [subsectionIds],
    ),
  ]);

  const checkboxesBy = groupBySubsection<CheckboxRow, Checkbox>(checkboxes.rows, (row) => ({
    id: row.id,
    label: row.label,
  }));
  const videosBy = groupBySubsection<VideoRow, SubsectionVideo>(videos.rows, (row) => ({
    id: row.id,
    provider: row.provider,
    externalId: row.external_id,
    label: row.label ?? undefined,
  }));
  const docsBy = groupBySubsection<DocRow, SubsectionDoc>(docs.rows, (row) => ({
    id: row.id,
    label: row.label,
    url: row.url,
  }));

  return result.rows.map((row: SubsectionRow) => ({
    id: row.id,
    title: row.title,
    loomId: row.loom_id ?? undefined,
    content: row.content,
    visibleToRoles: row.visible_to_roles ?? [],
    videos: videosBy.get(row.id) ?? [],
    docs: docsBy.get(row.id) ?? [],
    checkboxes: checkboxesBy.get(row.id) ?? [],
  }));
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
    "SELECT id, slug, title, description, visible_to_roles FROM courses WHERE slug = $1 OR id = $1 LIMIT 1",
    [slugOrId],
  );
  if (result.rows.length === 0) return undefined;

  const row = result.rows[0];
  return {
    id: row.slug,
    title: row.title,
    description: row.description,
    visibleToRoles: row.visible_to_roles ?? [],
    sections: await getSections(row.id),
  };
}

export async function getAllCourses(): Promise<Course[]> {
  const result = await pool.query(
    "SELECT id, slug, title, description, visible_to_roles FROM courses ORDER BY display_order",
  );

  return Promise.all(
    result.rows.map(async (row: CourseRow) => ({
      id: row.slug,
      title: row.title,
      // The column is nullable; Course.description is not.
      description: row.description ?? "",
      visibleToRoles: row.visible_to_roles ?? [],
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
    "SELECT id, slug, title, description, visible_to_roles FROM courses WHERE id = $1",
    [id],
  );
  if (result.rows.length === 0) return undefined;

  const row = result.rows[0];
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    visibleToRoles: row.visible_to_roles ?? [],
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

export async function createVideo(
  subsectionId: string,
  fields: { provider: VideoProvider; externalId: string; label?: string },
): Promise<string> {
  const count = await pool.query(
    "SELECT COUNT(*)::int AS n FROM course_subsection_videos WHERE subsection_id = $1",
    [subsectionId],
  );
  const result = await pool.query(
    `INSERT INTO course_subsection_videos (subsection_id, provider, external_id, label, display_order)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [subsectionId, fields.provider, fields.externalId, fields.label || null, count.rows[0].n],
  );
  return result.rows[0].id;
}

export async function updateVideo(
  id: string,
  fields: { provider: VideoProvider; externalId: string; label?: string },
): Promise<void> {
  await pool.query(
    `UPDATE course_subsection_videos SET provider = $2, external_id = $3, label = $4 WHERE id = $1`,
    [id, fields.provider, fields.externalId, fields.label || null],
  );
}

export async function deleteVideo(id: string): Promise<void> {
  await pool.query("DELETE FROM course_subsection_videos WHERE id = $1", [id]);
}

/**
 * Rewrites the whole order for one lesson's videos in a transaction.
 *
 * Whole-list rather than swap-a-pair: a partial reorder that fails halfway
 * leaves two rows sharing a display_order, and the read path's ORDER BY then
 * returns them in whatever order the planner feels like — a silent, unstable
 * shuffle rather than a visible error.
 */
export async function reorderVideos(subsectionId: string, orderedIds: string[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [index, id] of orderedIds.entries()) {
      await client.query(
        "UPDATE course_subsection_videos SET display_order = $3 WHERE id = $1 AND subsection_id = $2",
        [id, subsectionId, index],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createDoc(
  subsectionId: string,
  fields: { label: string; url: string },
): Promise<string> {
  const count = await pool.query(
    "SELECT COUNT(*)::int AS n FROM course_subsection_docs WHERE subsection_id = $1",
    [subsectionId],
  );
  const result = await pool.query(
    `INSERT INTO course_subsection_docs (subsection_id, label, url, display_order)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [subsectionId, fields.label, fields.url, count.rows[0].n],
  );
  return result.rows[0].id;
}

export async function updateDoc(
  id: string,
  fields: { label: string; url: string },
): Promise<void> {
  await pool.query("UPDATE course_subsection_docs SET label = $2, url = $3 WHERE id = $1", [
    id,
    fields.label,
    fields.url,
  ]);
}

export async function deleteDoc(id: string): Promise<void> {
  await pool.query("DELETE FROM course_subsection_docs WHERE id = $1", [id]);
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
