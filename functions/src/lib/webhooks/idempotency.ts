// SOURCE OF TRUTH: lib/webhooks/idempotency.ts (app side).
// functions/src has its own tsconfig `rootDir` and cannot import outside
// functions/src, so this copy is hand-synced rather than shared. Change both
// together (see Phase 2 brief, "TypeScript rootDir boundary").
import { Firestore } from "@google-cloud/firestore";
import { createHash } from "node:crypto";

const db = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT });

const PROCESSED_COLLECTION = "webhookEventsProcessed";

/**
 * At-least-once delivery is the default assumption for any webhook sender —
 * GHL and Meta both retry on a slow or dropped response. Handling the same
 * event twice (e.g. re-cloning a GHL location, double-creating a Slack
 * channel) is a data bug, not just a wasted API call, so every receiver
 * checks this before handling and records it after.
 */

export async function hasBeenProcessed(source: string, eventId: string): Promise<boolean> {
  const doc = await db.collection(PROCESSED_COLLECTION).doc(`${source}:${eventId}`).get();
  return doc.exists;
}

/**
 * Firestore's `create()` fails if the document already exists, so two
 * concurrent deliveries of the same event id race safely on this call —
 * exactly one create succeeds. Callers should treat the failure as "someone
 * else is handling this," not as an error to surface.
 */
export async function markProcessed(source: string, eventId: string): Promise<void> {
  await db
    .collection(PROCESSED_COLLECTION)
    .doc(`${source}:${eventId}`)
    .create({ source, eventId, processedAt: Date.now() });
}

/**
 * Releases a claimed event id after the guarded work actually failed, so a
 * legitimate retry (once the underlying problem is fixed) can run instead of
 * being permanently treated as a duplicate of a delivery that never finished.
 */
export async function clearProcessed(source: string, eventId: string): Promise<void> {
  await db.collection(PROCESSED_COLLECTION).doc(`${source}:${eventId}`).delete();
}

/**
 * Stable id for a webhook delivery that carries no id of its own. GHL/Meta's
 * own retries resend the identical body, so hashing the meaningful fields
 * de-dupes a retried delivery without blocking a later, genuinely different
 * submission (e.g. a client correcting their intake form).
 */
export function contentEventId(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
