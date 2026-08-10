import "server-only";
import { firestore } from "@/lib/firestore";
import type { DeadLetterEntry } from "./types";

const DLQ_COLLECTION = "webhookDeadLetter";

/**
 * Record a webhook event that couldn't be processed: bad signature,
 * duplicate delivery caught by lib/webhooks/idempotency.ts, an event type
 * the receiver doesn't recognize, or a handler that threw.
 *
 * This module does not retry anything — it's where a failed event lands so a
 * person can look at it, not a queue that re-delivers itself. Retrying is a
 * decision for whoever's triaging (see flagForReview / resolve below), or a
 * separate scheduled job if that's ever warranted.
 */
export async function recordFailure(
  entry: Omit<DeadLetterEntry, "id" | "flagged" | "resolved" | "receivedAt">,
): Promise<string> {
  const doc = await firestore()
    .collection(DLQ_COLLECTION)
    .add({ ...entry, receivedAt: Date.now(), flagged: false, resolved: false });
  return doc.id;
}

/**
 * Mark an entry for manual review. Separate from "resolved" on purpose:
 * flagging says a person needs to look at this; resolving says a person did.
 * A failure can be recorded and never flagged (low-signal noise you're
 * choosing to ignore) or flagged and sit unresolved (someone still owes a
 * look) — collapsing the two into one boolean would lose that distinction.
 */
export async function flagForReview(entryId: string, flaggedBy: string, reason?: string): Promise<void> {
  await firestore()
    .collection(DLQ_COLLECTION)
    .doc(entryId)
    .update({
      flagged: true,
      flaggedBy,
      flaggedReason: reason ?? null,
      flaggedAt: Date.now(),
    });
}

export async function resolve(entryId: string, resolvedBy: string): Promise<void> {
  await firestore().collection(DLQ_COLLECTION).doc(entryId).update({
    resolved: true,
    resolvedBy,
    resolvedAt: Date.now(),
  });
}

/** Flagged and still unresolved — the "needs a human now" list. */
export async function listFlagged(source?: string): Promise<DeadLetterEntry[]> {
  let query = firestore()
    .collection(DLQ_COLLECTION)
    .where("flagged", "==", true)
    .where("resolved", "==", false)
    .orderBy("receivedAt", "desc")
    .limit(200);

  if (source) query = query.where("source", "==", source);

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as DeadLetterEntry);
}

/** Everything unresolved, flagged or not — the full backlog. */
export async function listUnresolved(source?: string): Promise<DeadLetterEntry[]> {
  let query = firestore().collection(DLQ_COLLECTION).where("resolved", "==", false).orderBy("receivedAt", "desc").limit(200);

  if (source) query = query.where("source", "==", source);

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as DeadLetterEntry);
}
