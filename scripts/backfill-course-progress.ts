/**
 * Story 11.6 — move per-user course progress from Firestore into Postgres.
 *
 * Read-only against Firestore. It copies, counts both sides, and refuses to
 * report success unless they agree. AC2 says verified by count and not by
 * assumption, because a backfill declared done without one is how the courses
 * split-brain lasted as long as it did.
 *
 *   npx tsx scripts/backfill-course-progress.ts --dry-run
 *   npx tsx scripts/backfill-course-progress.ts
 *
 * Idempotent: the write is the same upsert the app uses, so re-running after a
 * partial failure converges rather than duplicating. Nothing in Firestore is
 * deleted here — that is a separate, later decision, and keeping the source
 * intact is what makes the count check meaningful.
 */
import "server-only";
import { firestore } from "@/lib/firestore";
import { pool } from "@/lib/postgres";

const DRY_RUN = process.argv.includes("--dry-run");

type Row = {
  uid: string;
  courseId: string;
  sectionId: string;
  subsectionId: string;
  checkboxId: string;
  completed: boolean;
  completedAt: Date | null;
};

/** Walks userProgress/{uid}/courses/{c}/sections/{s}/subsections/{ss}/checkboxes/{cb}. */
async function readFirestore(): Promise<Row[]> {
  const rows: Row[] = [];
  const users = await firestore().collection("userProgress").listDocuments();

  for (const user of users) {
    const courses = await user.collection("courses").listDocuments();
    for (const course of courses) {
      const sections = await course.collection("sections").listDocuments();
      for (const section of sections) {
        const subsections = await section.collection("subsections").listDocuments();
        for (const subsection of subsections) {
          const checkboxes = await subsection.collection("checkboxes").get();
          for (const checkbox of checkboxes.docs) {
            const data = checkbox.data();
            const at = data.completedAt;
            rows.push({
              uid: user.id,
              courseId: course.id,
              sectionId: section.id,
              subsectionId: subsection.id,
              checkboxId: checkbox.id,
              completed: Boolean(data.completed),
              completedAt: at && typeof at.toDate === "function" ? at.toDate() : null,
            });
          }
        }
      }
    }
  }
  return rows;
}

/**
 * `course_progress.uid` is a foreign key to `users`. A progress document whose
 * user was deleted cannot be inserted, and silently dropping it would make the
 * counts disagree with no explanation, so they are reported separately.
 */
async function knownUids(): Promise<Set<string>> {
  const result = await pool.query(`SELECT uid FROM users`);
  return new Set(result.rows.map((r) => String(r.uid)));
}

async function main(): Promise<void> {
  const rows = await readFirestore();
  console.log(`firestore: ${rows.length} checkbox record(s)`);

  const known = await knownUids();
  const insertable = rows.filter((r) => known.has(r.uid));
  const orphaned = rows.filter((r) => !known.has(r.uid));

  if (orphaned.length > 0) {
    const uids = [...new Set(orphaned.map((r) => r.uid))];
    console.warn(
      `skipping ${orphaned.length} record(s) for ${uids.length} uid(s) absent from users: ${uids.join(", ")}`,
    );
  }

  if (DRY_RUN) {
    console.log(`dry run: would write ${insertable.length} row(s). Nothing written.`);
    await pool.end();
    return;
  }

  for (const r of insertable) {
    await pool.query(
      `INSERT INTO course_progress
         (uid, course_id, section_id, subsection_id, checkbox_id, completed, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (uid, course_id, section_id, subsection_id, checkbox_id)
       DO UPDATE SET completed = EXCLUDED.completed,
                     completed_at = EXCLUDED.completed_at`,
      [r.uid, r.courseId, r.sectionId, r.subsectionId, r.checkboxId, r.completed, r.completedAt],
    );
  }

  // The verification, not a formality. Compare what Postgres holds for exactly
  // the users we copied against what Firestore had for them.
  const copiedUids = [...new Set(insertable.map((r) => r.uid))];
  const check = await pool.query(
    `SELECT count(*) AS n FROM course_progress WHERE uid = ANY($1::text[])`,
    [copiedUids],
  );
  const inPostgres = Number(check.rows[0].n);

  console.log(`postgres: ${inPostgres} row(s) for the ${copiedUids.length} copied uid(s)`);

  if (inPostgres !== insertable.length) {
    console.error(
      `COUNT MISMATCH: expected ${insertable.length}, found ${inPostgres}. ` +
        `Backfill is NOT verified. Do not delete anything from Firestore.`,
    );
    await pool.end();
    process.exit(1);
  }

  console.log(`verified: ${inPostgres} row(s) match. Backfill complete.`);
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
