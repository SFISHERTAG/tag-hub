export type Checkbox = {
  id: string;
  label: string;
};

export type Subsection = {
  id: string;
  title: string;
  loomId?: string;
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
