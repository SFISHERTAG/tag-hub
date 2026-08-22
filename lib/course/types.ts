export type Checkbox = {
  id: string;
  label: string;
};

/** Providers the player knows how to embed. Mirrors the CHECK on the table. */
export type VideoProvider = "loom" | "fathom" | "drive";

export type SubsectionVideo = {
  id: string;
  provider: VideoProvider;
  /** Provider-native id, parsed from the share URL. Not a URL. */
  externalId: string;
  label?: string;
};

export type SubsectionDoc = {
  id: string;
  label: string;
  url: string;
};

export type Subsection = {
  id: string;
  title: string;
  /** Empty means every signed-in user. See lib/course/visibility.ts. */
  visibleToRoles: string[];
  /**
   * The single-Loom fast path, kept from the original schema. A subsection may
   * have this, or rows in `videos`, or both; the player renders `videos` when
   * there are any and falls back to this when there are not.
   */
  loomId?: string;
  videos: SubsectionVideo[];
  docs: SubsectionDoc[];
  checkboxes: Checkbox[];
  content: string;
};

export type Section = {
  id: string;
  title: string;
  subsections: Subsection[];
};

export type Course = {
  id: string;
  title: string;
  description: string;
  /** Empty means every signed-in user. See lib/course/visibility.ts. */
  visibleToRoles: string[];
  sections: Section[];
};

export type UserProgress = {
  uid: string;
  courseId: string;
  sectionId: string;
  subsectionId: string;
  checkboxId: string;
  completed: boolean;
  completedAt?: number;
};
