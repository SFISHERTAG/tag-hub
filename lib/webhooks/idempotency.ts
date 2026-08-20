// SOURCE OF TRUTH: duplicated in functions/src/lib/webhooks/idempotency.ts.
// functions/src has its own tsconfig `rootDir` and cannot import outside
// functions/src, so that copy is hand-synced rather than shared. Change both
// together (see Phase 2 brief, "TypeScript rootDir boundary").
import "server-only";
import { createHash } from "node:crypto";
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

/** Firestore's gRPC status code for ALREADY_EXISTS. */
const ALREADY_EXISTS = 6;

/**
 * Claims an event id, distinguishing "someone else has it" from "the claim
 * itself failed".
 *
 * `markProcessed` was called inside a bare `catch {}` that treated every
 * failure as a concurrent delivery and answered the sender with
 * `{ success: true, duplicate: true }`. A genuine ALREADY_EXISTS is exactly
 * that, but a Firestore outage, a permission error, or a network timeout is
 * not — and each one told the sender its event had been handled. The sender
 * stops retrying, nothing ever processed the event, and there is no record
 * that anything went wrong.
 *
 * So the ALREADY_EXISTS case returns "duplicate" and everything else throws,
 * which surfaces as a 500 and lets the sender retry.
 */
export async function claimEvent(
  source: string,
  eventId: string,
): Promise<"claimed" | "duplicate"> {
  try {
    await markProcessed(source, eventId);
    return "claimed";
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    if (code === ALREADY_EXISTS) return "duplicate";

    // Some transports surface it as a message rather than a numeric code.
    if (error instanceof Error && /already exists/i.test(error.message)) return "duplicate";

    throw error;
  }
}

/**
 * Releases a claimed event id after the guarded work actually failed, so a
 * legitimate retry (once the underlying problem is fixed) can run instead of
 * being permanently treated as a duplicate of a delivery that never finished.
 */
export async function clearProcessed(source: string, eventId: string): Promise<void> {
  await firestore().collection(PROCESSED_COLLECTION).doc(`${source}:${eventId}`).delete();
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
