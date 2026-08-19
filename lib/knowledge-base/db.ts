import "server-only";
import { firestore } from "@/lib/firestore";
import type { ManualPage, ManualPageSummary, ManualPageVersion } from "./types";

/**
 * Knowledge base (TAG CSM Operating Manual) content, in Firestore.
 *
 * `manual_pages/{pageId}` is the live doc. Every write also appends a full
 * snapshot to `manual_pages/{pageId}/versions/{versionId}` before updating
 * the live doc, mirroring the flow_audit_log revert-capable pattern
 * (lib/flow/db.ts#logChange) — edits are never destructive, and reverting
 * writes a new version rather than deleting the ones after it.
 */

const COLLECTION = "manual_pages";

function pageDoc(pageId: string) {
  return firestore().collection(COLLECTION).doc(pageId);
}

function toManualPage(id: string, data: FirebaseFirestore.DocumentData): ManualPage {
  return {
    id,
    num: data.num,
    title: data.title,
    eyebrow: data.eyebrow,
    lede: data.lede,
    status: data.status,
    level: data.level,
    blocks: data.blocks ?? [],
  };
}

export async function listManualPages(): Promise<ManualPageSummary[]> {
  const snap = await firestore().collection(COLLECTION).orderBy("num").get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    return { id: doc.id, num: data.num, title: data.title, eyebrow: data.eyebrow, status: data.status };
  });
}

export async function getManualPage(pageId: string): Promise<ManualPage | null> {
  const doc = await pageDoc(pageId).get();
  if (!doc.exists) return null;
  return toManualPage(doc.id, doc.data()!);
}

/**
 * Seed or overwrite a page with no version recorded — for the one-time
 * migration script only. Admin edits always go through `updateManualPage`
 * so they're versioned.
 */
export async function seedManualPage(page: ManualPage): Promise<void> {
  const { id, ...fields } = page;
  await pageDoc(id).set(fields);
}

export async function listManualPageVersions(pageId: string): Promise<ManualPageVersion[]> {
  const snap = await pageDoc(pageId).collection("versions").orderBy("createdAt", "desc").get();
  return snap.docs.map((doc) => doc.data() as ManualPageVersion);
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
  if (!current.exists) throw new Error(`manual_pages/${pageId} does not exist`);

  const versionId = doc.collection("versions").doc().id;
  const version: ManualPageVersion = {
    id: versionId,
    page: toManualPage(pageId, current.data()!),
    authorUid: actor.uid,
    authorEmail: actor.email,
    createdAt: Date.now(),
  };

  const batch = firestore().batch();
  batch.set(doc.collection("versions").doc(versionId), version);
  batch.set(doc, next);
  await batch.commit();
}

export async function revertManualPage(
  pageId: string,
  versionId: string,
  actor: { uid: string; email: string },
): Promise<void> {
  const versionDoc = await pageDoc(pageId).collection("versions").doc(versionId).get();
  if (!versionDoc.exists) throw new Error(`version ${versionId} not found for manual_pages/${pageId}`);
  const version = versionDoc.data() as ManualPageVersion;
  const { num, title, eyebrow, lede, status, level, blocks } = version.page;
  await updateManualPage(pageId, { num, title, eyebrow, lede, status, level, blocks }, actor);
}
