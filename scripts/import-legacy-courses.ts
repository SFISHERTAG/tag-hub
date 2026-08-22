import { pool } from "../lib/postgres";
import { NEW_LEGACY_COURSES, type LegacyCourse } from "../lib/course/legacy-content";

/**
 * One-time import of the legacy Skool trainings (story 12.4).
 *
 * Imports the two courses that do not exist in the Hub at all: CSM Training,
 * in the post-consolidation shape the course update outline specifies, and
 * Internal Sales Rep Training.
 *
 * Run:
 *   DB_HOST=... DB_USER=... DB_PASSWORD=... DB_NAME=... \
 *   IMPORT_TARGET=<the database name you mean> npx tsx scripts/import-legacy-courses.ts
 *
 * Add `--dry-run` to print what would be written and touch nothing.
 *
 * GUARD. `scripts/setup-csm-test-data.ts` and `setup-phase3-test-data.ts` write
 * with no environment check at all, inheriting a fallback that points at the
 * production project — the audit's data-loss finding. This script refuses to
 * run unless `IMPORT_TARGET` is set and matches the database it is actually
 * connected to, so "I thought I was pointed at staging" is a refusal rather
 * than an overwrite.
 *
 * IDEMPOTENCE. A course is matched by slug. Re-running replaces that course's
 * sections wholesale inside one transaction: `ON DELETE CASCADE` clears the old
 * lessons, videos, docs and checkboxes, and the tree is rewritten from source.
 * The `courses` row itself is preserved rather than deleted and recreated, so
 * its id stays stable and any `course_progress` keyed to it survives.
 */

type Options = { dryRun: boolean };

function parseOptions(argv: string[]): Options {
  return { dryRun: argv.includes("--dry-run") };
}

async function assertTarget(): Promise<string> {
  const intended = process.env.IMPORT_TARGET;
  if (!intended) {
    throw new Error(
      "IMPORT_TARGET is not set. Set it to the database name you mean to write to, e.g. IMPORT_TARGET=tag_automation.",
    );
  }

  const result = await pool.query(
    "SELECT current_database() AS db, current_user AS usr, inet_server_addr()::text AS host",
  );
  const { db, usr, host } = result.rows[0];

  if (db !== intended) {
    throw new Error(
      `Refusing to write: connected to database "${db}" but IMPORT_TARGET says "${intended}".`,
    );
  }

  console.log(`Connected to ${db} as ${usr}${host ? ` at ${host}` : ""}.`);
  return db;
}

async function importCourse(
  client: { query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, string>[] }> },
  course: LegacyCourse,
  displayOrder: number,
): Promise<{ lessons: number; videos: number; docs: number }> {
  const existing = await client.query("SELECT id FROM courses WHERE slug = $1", [course.slug]);

  let courseId: string;
  if (existing.rows.length > 0) {
    courseId = existing.rows[0].id;
    await client.query(
      `UPDATE courses SET title = $2, description = $3, visible_to_roles = $4, updated_at = now()
       WHERE id = $1`,
      [courseId, course.title, course.description, course.visibleToRoles],
    );
    // Cascades to subsections, and from there to videos, docs and checkboxes.
    await client.query("DELETE FROM course_sections WHERE course_id = $1", [courseId]);
    console.log(`  ${course.slug}: existing course, sections replaced`);
  } else {
    const inserted = await client.query(
      `INSERT INTO courses (slug, title, description, display_order, visible_to_roles)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [course.slug, course.title, course.description, displayOrder, course.visibleToRoles],
    );
    courseId = inserted.rows[0].id;
    console.log(`  ${course.slug}: new course`);
  }

  let lessons = 0;
  let videos = 0;
  let docs = 0;

  for (const [sectionIndex, section] of course.sections.entries()) {
    const sectionRow = await client.query(
      "INSERT INTO course_sections (course_id, title, display_order) VALUES ($1, $2, $3) RETURNING id",
      [courseId, section.title, sectionIndex],
    );
    const sectionId = sectionRow.rows[0].id;

    for (const [lessonIndex, lesson] of section.lessons.entries()) {
      const lessonRow = await client.query(
        `INSERT INTO course_subsections (section_id, title, content, display_order, visible_to_roles)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [sectionId, lesson.title, lesson.content, lessonIndex, lesson.visibleToRoles ?? []],
      );
      const lessonId = lessonRow.rows[0].id;
      lessons++;

      for (const [videoIndex, video] of lesson.videos.entries()) {
        await client.query(
          `INSERT INTO course_subsection_videos (subsection_id, provider, external_id, label, display_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [lessonId, video.provider, video.externalId, video.label ?? null, videoIndex],
        );
        videos++;
      }

      for (const [docIndex, doc] of lesson.docs.entries()) {
        await client.query(
          `INSERT INTO course_subsection_docs (subsection_id, label, url, display_order)
           VALUES ($1, $2, $3, $4)`,
          [lessonId, doc.label, doc.url, docIndex],
        );
        docs++;
      }

      for (const [checkboxIndex, label] of lesson.checkboxes.entries()) {
        await client.query(
          "INSERT INTO course_checkboxes (subsection_id, label, display_order) VALUES ($1, $2, $3)",
          [lessonId, label, checkboxIndex],
        );
      }
    }
  }

  return { lessons, videos, docs };
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  await assertTarget();

  if (options.dryRun) {
    console.log("Dry run. Nothing will be written.\n");
    for (const course of NEW_LEGACY_COURSES) {
      const lessons = course.sections.flatMap((section) => section.lessons);
      console.log(
        `  ${course.slug}: ${lessons.length} lessons, ` +
          `${lessons.reduce((sum, lesson) => sum + lesson.videos.length, 0)} videos, ` +
          `${lessons.reduce((sum, lesson) => sum + lesson.docs.length, 0)} docs, ` +
          `visible to [${course.visibleToRoles.join(", ") || "everyone"}]`,
      );
      for (const lesson of lessons) {
        console.log(
          `    - ${lesson.title} (${lesson.videos.length} video${lesson.videos.length === 1 ? "" : "s"}` +
            `${lesson.content ? `, ${lesson.content.length} chars` : ", no body"})`,
        );
      }
    }
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Ordered after the two seeded courses, which hold display_order 0 and 1.
    let order = 2;
    for (const course of NEW_LEGACY_COURSES) {
      const counts = await importCourse(client, course, order++);
      console.log(
        `    ${counts.lessons} lessons, ${counts.videos} videos, ${counts.docs} reference docs`,
      );
    }

    await client.query("COMMIT");
    console.log("\nDone.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await pool.end();
    process.exit(1);
  });
