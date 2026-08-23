import "server-only";
import { pool } from "@/lib/postgres";

/**
 * Per-user course progress, on Postgres.
 *
 * Story 11.6. This replaces `lib/course/firestore.ts`, which held the same data
 * in a five-level document tree while `course_progress` sat in Postgres as an
 * empty schema nothing read. One entity, two stores, one of them live: the
 * split-brain the pre-commit hook exists to block, already in the tree.
 *
 * The five-part Firestore path (uid / course / section / subsection / checkbox)
 * is the table's composite primary key, so the shape is preserved exactly and
 * the map keys the UI indexes by are unchanged.
 *
 * `getCourseProgress` is the reason this is worth doing on its own: the
 * Firestore version walked sections, then subsections, then checkboxes, which
 * is one query per node and dozens per page. Here it is one.
 */

export type ProgressDoc = {
  completed: boolean;
  completedAt?: number;
};

/** Completion for one user against one course. */
export type CompletionRate = {
  uid: string;
  completed: number;
  total: number;
  /** 0 when the course has no tracked checkboxes, rather than NaN. */
  rate: number;
};

function toMillis(value: Date | string | null | undefined): number | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
}

/** One checkbox for one user, or null if never recorded. */
export async function getUserCheckboxProgress(
  uid: string,
  courseId: string,
  sectionId: string,
  subsectionId: string,
  checkboxId: string,
): Promise<ProgressDoc | null> {
  const result = await pool.query(
    `SELECT completed, completed_at
       FROM course_progress
      WHERE uid = $1 AND course_id = $2 AND section_id = $3
        AND subsection_id = $4 AND checkbox_id = $5`,
    [uid, courseId, sectionId, subsectionId, checkboxId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    completed: Boolean(row.completed),
    completedAt: toMillis(row.completed_at),
  };
}

/**
 * Records a tick or an un-tick.
 *
 * Upsert rather than insert: the primary key is the whole path, and a user
 * re-ticking a box they already ticked is ordinary, not a conflict. Un-ticking
 * clears `completed_at` instead of leaving the old timestamp behind, so the
 * column always means "when this was completed", never "when it last was".
 */
export async function updateCheckboxProgress(
  uid: string,
  courseId: string,
  sectionId: string,
  subsectionId: string,
  checkboxId: string,
  completed: boolean,
): Promise<void> {
  await pool.query(
    `INSERT INTO course_progress
       (uid, course_id, section_id, subsection_id, checkbox_id, completed, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (uid, course_id, section_id, subsection_id, checkbox_id)
     DO UPDATE SET completed = EXCLUDED.completed,
                   completed_at = EXCLUDED.completed_at`,
    [uid, courseId, sectionId, subsectionId, checkboxId, completed, completed ? new Date() : null],
  );
}

/** Every recorded checkbox for one user in one course, keyed `section/subsection/checkbox`. */
export async function getCourseProgress(
  uid: string,
  courseId: string,
): Promise<Map<string, ProgressDoc>> {
  const result = await pool.query(
    `SELECT section_id, subsection_id, checkbox_id, completed, completed_at
       FROM course_progress
      WHERE uid = $1 AND course_id = $2`,
    [uid, courseId],
  );

  const progress = new Map<string, ProgressDoc>();
  for (const row of result.rows) {
    progress.set(`${row.section_id}/${row.subsection_id}/${row.checkbox_id}`, {
      completed: Boolean(row.completed),
      completedAt: toMillis(row.completed_at),
    });
  }
  return progress;
}

/**
 * Completion rate per user for one course.
 *
 * AC5, and the reason Option A was chosen over keeping Firestore: this is the
 * query the document tree could not answer without reading every user's whole
 * subtree. Counting happens in Postgres; only the finished numbers cross the
 * wire.
 */
export async function getCourseCompletionRates(courseId: string): Promise<CompletionRate[]> {
  const result = await pool.query(
    `SELECT uid,
            count(*) FILTER (WHERE completed) AS completed_count,
            count(*) AS total_count
       FROM course_progress
      WHERE course_id = $1
      GROUP BY uid
      ORDER BY uid`,
    [courseId],
  );

  return result.rows.map((row) => {
    const completed = Number(row.completed_count);
    const total = Number(row.total_count);
    return { uid: row.uid, completed, total, rate: total === 0 ? 0 : completed / total };
  });
}
