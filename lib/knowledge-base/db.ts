import "server-only";
import { repository } from "@/lib/data";
import type { ManualPageVersion as StoredVersion } from "@/lib/data";
import { toFields, fromFields } from "./serialize";
import type { ManualPage, ManualPageSummary, ManualPageVersion } from "./types";

/**
 * Knowledge base (TAG CSM Operating Manual) content, in Firestore.
 *
 * `manual_pages/{pageId}` is the live doc. Every write also appends a full
 * snapshot to `manual_pages/{pageId}/versions/{versionId}` before updating
 * the live doc, mirroring the flow_audit_log revert-capable pattern
 * (lib/flow/db.ts#logChange) — edits are never destructive, and reverting
 * writes a new version rather than deleting the ones after it.
 *
 * Field-level (de)serialization (the `blocksJson` string encoding) lives in
 * `./serialize.ts`, not here — that file has no `server-only` marker so
 * `scripts/migrate-manual-to-firestore.ts` (a plain Node script, not a
 * Next.js server context) can share it without triggering server-only's
 * "cannot be imported from a Client Component" throw.
 */

function pageDoc(pageId: string) {
  return repository().manualPages.doc(pageId);
}

function versions(pageId: string) {
  return repository().manualPageVersions(pageId);
}

export async function listManualPages(): Promise<ManualPageSummary[]> {
  const found = await repository().manualPages.list({ orderBy: { field: "num" } });
  return found.map(({ id, data }) => ({
    id,
    num: data.num,
    title: data.title,
    eyebrow: data.eyebrow,
    status: data.status,
  })) as ManualPageSummary[];
}

export async function getManualPage(pageId: string): Promise<ManualPage | null> {
  const data = await pageDoc(pageId).get();
  if (!data) return null;
  return fromFields(pageId, data);
}

/**
 * Seed or overwrite a page with no version recorded — for the one-time
 * migration script only. Admin edits always go through `updateManualPage`
 * so they're versioned.
 */
export async function seedManualPage(page: ManualPage): Promise<void> {
  const { id, ...fields } = page;
  await pageDoc(id).set(toFields(fields));
}

function toManualPageVersion(id: string, data: StoredVersion): ManualPageVersion {
  return {
    id,
    page: fromFields(data.pageId, data.page),
    authorUid: data.authorUid,
    authorEmail: data.authorEmail,
    createdAt: data.createdAt,
  };
}

export async function listManualPageVersions(pageId: string): Promise<ManualPageVersion[]> {
  const found = await versions(pageId).list({
    orderBy: { field: "createdAt", direction: "desc" },
  });
  return found.map(({ id, data }) => toManualPageVersion(id, data));
}

/**
 * Records the page's current content as a version, then writes `next` as
 * the new live content. The version captures what was live *before* this
 * edit, so version history reads as "what it was, and who changed it away
 * from that" rather than "what it became".
 */
export async function updateManualPage(
  pageId: string,
  next: Omit<ManualPage, "id">,
  actor: { uid: string; email: string },
): Promise<void> {
  const doc = pageDoc(pageId);
  const current = await doc.get();
  if (!current) throw new Error(`manual_pages/${pageId} does not exist`);

  const versionId = versions(pageId).newId();
  const versionFields = {
    pageId,
    page: current, // already in stored (blocksJson) form — round-trips through fromFields on read
    authorUid: actor.uid,
    authorEmail: actor.email,
    createdAt: Date.now(),
  };

  // One batch, not two writes: the version snapshot and the new live content
  // must land together. A partial write loses the ability to revert to what
  // was there a moment ago, which is the whole point of the versions
  // subcollection.
  const batch = repository().batch();
  batch.set(versions(pageId).doc(versionId), versionFields);
  batch.set(doc, toFields(next));
  await batch.commit();
}

export async function revertManualPage(
  pageId: string,
  versionId: string,
  actor: { uid: string; email: string },
): Promise<void> {
  const versionData = await versions(pageId).doc(versionId).get();
  if (!versionData) throw new Error(`version ${versionId} not found for manual_pages/${pageId}`);
  const version = toManualPageVersion(versionId, versionData);
  const { num, title, eyebrow, lede, status, level, blocks } = version.page;
  await updateManualPage(pageId, { num, title, eyebrow, lede, status, level, blocks }, actor);
}
