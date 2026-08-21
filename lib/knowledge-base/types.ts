/**
 * Shape of the manual content, unchanged from `_archive/manual-content.json`
 * (source: TAG CSM Operating Manual v1.0) — only the storage moved, not the
 * schema. `blocks` stays a loose union rather than one strict shape because
 * new block types (paragraph, table, note, heading, procedure, instrument)
 * appear per-page in the source and the admin editor edits them as raw JSON
 * per block, not through per-type form fields.
 */
export type ManualBlock = Record<string, unknown> & { type: string };

export type ManualPage = {
  id: string;
  num: string;
  title: string;
  eyebrow: string;
  lede: string;
  status: string;
  level: string;
  blocks: ManualBlock[];
};

export type ManualPageSummary = Pick<ManualPage, "id" | "num" | "title" | "eyebrow" | "status">;

export type ManualPageVersion = {
  id: string;
  page: ManualPage;
  authorUid: string;
  authorEmail: string;
  createdAt: number;
};
