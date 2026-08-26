import { pool } from "../lib/postgres";
import { AUTHORED_CHANGES, AUTHORED_COURSE_SLUG } from "../lib/course/authored-lessons";

/**
 * Story 12.5: writes the authored CSM lessons into the course.
 *
 * Run:
 *   DB_HOST=... DB_USER=... DB_PASSWORD=... DB_NAME=... \
 *   IMPORT_TARGET=<the database name you mean> npx tsx scripts/apply-authored-lessons.ts
 *
 * `--dry-run` prints the plan and touches nothing.
 *
 * DDL is deliberately absent. This is inserts and updates on tables that
 * already exist, so it runs as `tag_app_user` and needs no owner credential —
 * which matters, because the course tables are owned by `postgres` and story
 * 12.4's migrations could not be applied by the app user.
 *
 * Idempotent. An edit rewrites a body that is already there. An insert checks
 * for its own title first and updates instead of adding a second copy, so a
 * re-run after a partial failure does not leave the course with two Fulfillment
 * Intros.
 */

type Client = {
  query: (
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: Record<string, string>[]; rowCount: number | null }>;
};

async function assertTarget(): Promise<void> {
  const intended = process.env.IMPORT_TARGET;
  if (!intended) {
    throw new Error(
      "IMPORT_TARGET is not set. Set it to the database name you mean to write to, e.g. IMPORT_TARGET=tag_automation.",
    );
  }

  const result = await pool.query("SELECT current_database() AS db, current_user AS usr");
  const { db, usr } = result.rows[0];
  if (db !== intended) {
    throw new Error(
      `Refusing to write: connected to database "${db}" but IMPORT_TARGET says "${intended}".`,
    );
  }
  console.log(`Connected to ${db} as ${usr}.`);
}

/** The single section the CSM course keeps all its lessons in. */
async function sectionOf(client: Client, slug: string): Promise<string> {
  const result = await client.query(
    `SELECT s.id FROM course_sections s
     JOIN courses c ON c.id = s.course_id
     WHERE c.slug = $1 ORDER BY s.display_order LIMIT 1`,
    [slug],
  );
  if (result.rows.length === 0) throw new Error(`No sections found for course "${slug}".`);
  return result.rows[0].id;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  await assertTarget();

  if (dryRun) {
    console.log("Dry run. Nothing will be written.\n");
    for (const change of AUTHORED_CHANGES) {
      console.log(
        change.kind === "edit"
          ? `  edit   ${change.matchTitle} (${change.content.length} chars)`
          : `  insert ${change.title} before "${change.before}" (${change.content.length} chars)`,
      );
    }
    return;
  }

  const client = (await pool.connect()) as unknown as Client & { release: () => void };
  try {
    await client.query("BEGIN");
    const sectionId = await sectionOf(client, AUTHORED_COURSE_SLUG);

    for (const change of AUTHORED_CHANGES) {
      if (change.kind === "edit") {
        const updated = await client.query(
          `UPDATE course_subsections SET content = $3, updated_at = now()
           WHERE section_id = $1 AND title = $2`,
          [sectionId, change.matchTitle, change.content],
        );
        if ((updated.rowCount ?? 0) !== 1) {
          throw new Error(
            `Expected exactly one lesson titled "${change.matchTitle}", matched ${updated.rowCount ?? 0}.`,
          );
        }
        console.log(`  edited   ${change.matchTitle}`);
        continue;
      }

      const existing = await client.query(
        "SELECT id FROM course_subsections WHERE section_id = $1 AND title = $2",
        [sectionId, change.title],
      );

      if (existing.rows.length > 0) {
        await client.query(
          "UPDATE course_subsections SET content = $2, updated_at = now() WHERE id = $1",
          [existing.rows[0].id, change.content],
        );
        console.log(`  rewrote  ${change.title} (already present)`);
        continue;
      }

      const anchor = await client.query(
        "SELECT display_order FROM course_subsections WHERE section_id = $1 AND title = $2",
        [sectionId, change.before],
      );
      const last = await client.query(
        "SELECT COALESCE(MAX(display_order) + 1, 0) AS next FROM course_subsections WHERE section_id = $1",
        [sectionId],
      );
      const position = anchor.rows.length > 0 ? Number(anchor.rows[0].display_order) : Number(last.rows[0].next);

      // Make room. Everything at or after the anchor shifts down one.
      await client.query(
        "UPDATE course_subsections SET display_order = display_order + 1 WHERE section_id = $1 AND display_order >= $2",
        [sectionId, position],
      );

      const inserted = await client.query(
        `INSERT INTO course_subsections (section_id, title, content, display_order, visible_to_roles)
         VALUES ($1, $2, $3, $4, '{}') RETURNING id`,
        [sectionId, change.title, change.content, position],
      );
      const lessonId = inserted.rows[0].id;

      for (const [index, label] of change.checkboxes.entries()) {
        await client.query(
          "INSERT INTO course_checkboxes (subsection_id, label, display_order) VALUES ($1, $2, $3)",
          [lessonId, label, index],
        );
      }

      console.log(`  inserted ${change.title} at position ${position}`);
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
