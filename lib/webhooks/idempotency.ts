import "server-only";
import { firestore } from "@/lib/firestore";

const PROCESSED_COLLECTION = "webhookEventsProcessed";

/**
 * At-least-once delivery is the default assumption for any webhook sender —
 * GHL and Meta both retry on a slow or dropped response. Handling the same
 * event twice (e.g. double-marking a conversion) is a data bug, not just a
 * wasted API call, so every receiver checks this before handling and records
 * it after.
 */

export async function hasBeenProcessed(source: string, eventId: string): Promise<boolean> {
  const doc = await firestore().collection(PROCESSED_COLLECTION).doc(`${source}:${eventId}`).get();
  return doc.exists;
}

/**
 * Firestore's `create()` fails if the document already exists, so two
 * concurrent deliveries of the same event id race safely on this call —
 * exactly one create succeeds. Callers should treat the failure as "someone
 * else is handling this," not as an error to surface.
 */
export async function markProcessed(source: string, eventId: string): Promise<void> {
  await firestore()
    .collection(PROCESSED_COLLECTION)
    .doc(`${source}:${eventId}`)
    .create({ source, eventId, processedAt: Date.now() });
}
