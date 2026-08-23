/**
 * Wire shapes for `/api/admin/courses*`, mirrored from lib/course/types.ts.
 *
 * The courses *viewer* (features/courses) declares its own copy of this tree
 * rather than importing this one. That is the feature-isolation rule from
 * CLAUDE.md, and it is not merely bureaucratic here: the two screens read the
 * same tree for different reasons, and the editor will grow authoring fields
 * the viewer must never be given a reason to render.
 */
export interface CourseCheckbox {
  readonly id: string;
  readonly label: string;
}

export type VideoProvider = 'loom' | 'fathom' | 'drive';

export interface CourseVideo {
  readonly id: string;
  readonly provider: VideoProvider;
  readonly externalId: string;
  readonly label?: string;
}

export interface CourseDoc {
  readonly id: string;
  readonly label: string;
  readonly url: string;
}

export interface CourseSubsection {
  readonly id: string;
  readonly title: string;
  /** The single-Loom fast path. Kept editable; `videos` is the general case. */
  readonly loomId?: string;
  readonly videos: readonly CourseVideo[];
  readonly docs: readonly CourseDoc[];
  readonly checkboxes: readonly CourseCheckbox[];
  readonly content: string;
}

/**
 * `link` is whatever the admin pasted — a share URL or a bare id. The server
 * parses it and answers 400 on anything it does not recognise, so the editor
 * never has to decide what a valid Fathom id looks like.
 */
export interface VideoWrite {
  readonly link: string;
  readonly provider?: VideoProvider;
  readonly label?: string;
}

export interface DocWrite {
  readonly label: string;
  readonly url: string;
}

export interface CreatedVideo {
  readonly videoId: string;
}

export interface CreatedDoc {
  readonly docId: string;
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

export interface CourseSummary {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
}

export interface CourseSummaryList {
  readonly courses: readonly CourseSummary[];
}

export interface CourseDetail {
  readonly course: Course;
}

export interface SubsectionUpdate {
  readonly title: string;
  readonly loomId: string;
  readonly content: string;
}

export interface CreatedSection {
  readonly sectionId: string;
}

export interface CreatedSubsection {
  readonly subsectionId: string;
}

export interface CreatedCheckbox {
  readonly checkboxId: string;
}

export interface Acknowledged {
  readonly ok: true;
}
