import type { ManualPage } from "./types";

/**
 * Pure (no "server-only") on purpose: `scripts/migrate-manual-to-firestore.ts`
 * runs as a plain Node script, not inside Next.js, so it can't import
 * `lib/knowledge-base/db.ts` (which is `server-only` and throws outside a
 * Next.js server context). This is the serialization logic both share.
 *
 * `blocks` is stored as a JSON string (`blocksJson`), not a native Firestore
 * array/map. The source manual's `table` blocks carry `rows: string[][]` —
 * an array nested directly inside an array — which Firestore rejects
 * outright ("Property array contains an invalid nested entity"). JSON-
 * encoding the whole field sidesteps that for any block shape, not just
 * today's `rows`.
 */
export type ManualPageFields = Omit<ManualPage, "id" | "blocks"> & { blocksJson: string };

export function toFields(page: Omit<ManualPage, "id">): ManualPageFields {
  const { blocks, ...rest } = page;
  return { ...rest, blocksJson: JSON.stringify(blocks) };
}

export function fromFields(id: string, data: FirebaseFirestore.DocumentData): ManualPage {
  return {
    id,
    num: data.num,
    title: data.title,
    eyebrow: data.eyebrow,
    lede: data.lede,
    status: data.status,
    level: data.level,
    blocks: data.blocksJson ? JSON.parse(data.blocksJson) : (data.blocks ?? []),
  };
}
