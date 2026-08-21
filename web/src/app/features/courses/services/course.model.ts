/**
 * Wire shapes for `/api/courses*`, mirrored from lib/course/types.ts.
 *
 * Declared here rather than imported from features/admin: a feature module may
 * not import a sibling (CLAUDE.md, architecture isolation). The two copies
 * describe the same stored tree for different jobs — this one is read-only and
 * carries progress, the admin one carries authoring fields.
 */
export interface CourseCheckbox {
  readonly id: string;
  readonly label: string;
}

export interface CourseSubsection {
  readonly id: string;
  readonly title: string;
  readonly loomId?: string;
  readonly checkboxes: readonly CourseCheckbox[];
  readonly content: string;
}

export interface CourseSection {
  readonly id: string;
  readonly title: string;
  readonly subsections: readonly CourseSubsection[];
}

export interface Course {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly sections: readonly CourseSection[];
}

export interface CourseCard {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly subsectionCount: number;
}

export interface CourseCardList {
  readonly courses: readonly CourseCard[];
}

/** One checkbox's stored state. `completedAt` is epoch milliseconds. */
export interface ProgressEntry {
  readonly completed: boolean;
  readonly completedAt?: number;
}

/**
 * Progress keyed `"sectionId/subsectionId/checkboxId"`.
 *
 * A plain object rather than a Map because that is what survives JSON. The
 * endpoint flattens its Map with exactly this key shape, so the client indexes
 * it directly instead of rebuilding a lookup and inventing a second key format
 * along the way.
 */
export type ProgressMap = Readonly<Record<string, ProgressEntry>>;

export interface CourseWithProgress {
  readonly course: Course;
  readonly progress: ProgressMap;
}

/**
 * What `POST /api/courses/progress` answers with.
 *
 * `completed` is read back from the store after the write, not echoed from the
 * request, so the client reconciles against what is actually persisted rather
 * than against its own optimistic guess.
 */
export interface ProgressSaved {
  readonly ok: true;
  readonly key: string;
  readonly completed: boolean;
  readonly completedAt: number | null;
}

export interface ProgressToggle {
  readonly courseId: string;
  readonly sectionId: string;
  readonly subsectionId: string;
  readonly checkboxId: string;
  readonly completed: boolean;
}

/** The one key format, defined once so the reader and the writer cannot disagree. */
export function progressKey(
  sectionId: string,
  subsectionId: string,
  checkboxId: string,
): string {
  return `${sectionId}/${subsectionId}/${checkboxId}`;
}
