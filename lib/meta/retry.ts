import "server-only";
import { firestore } from "@/lib/firestore";
import { getContact } from "@/lib/ghl/contacts";
import { recordFailure, flagForReview } from "@/lib/webhooks/deadLetterQueue";
import { slackConfigured, postAlert } from "@/lib/slack";
import {
  buildUserData,
  postConversionEvent,
  computeNextRetryAt,
  writeConversionLog,
  MAX_ATTEMPTS,
  type ConversionLogEntry,
} from "@/lib/meta/conversions";

/**
 * Story 6.5's hourly retry job. Queries the last 24h of "failed" conversion
 * dispatches across every location, retries the ones whose backoff window
 * has elapsed, and escalates anything that has exhausted MAX_ATTEMPTS.
 *
 * Meta event_id is the appointmentId/opportunityId — stable across retries —
 * so a retry firing after Meta actually received the original but the HTTP
 * response was lost is deduped on Meta's side, not recorded twice. See
 * conversions.test.ts / retry.test.ts for the assertion this holds.
 */

const WINDOW_MS = 24 * 60 * 60 * 1000;
const EVENT_NAME: Record<ConversionLogEntry["eventType"], string> = {
  showed: "ViewContent",
  closed_won: "Purchase",
};

export type RetryRunSummary = {
  scanned: number;
  retried: number;
  succeeded: number;
  stillFailed: number;
  escalated: number;
};

function locationIdFromDocPath(path: string): string {
  // locations/{locationId}/metaConversionLog/{docId}
  const parts = path.split("/");
  const idx = parts.indexOf("locations");
  return parts[idx + 1];
}

async function retryOne(doc: FirebaseFirestore.QueryDocumentSnapshot): Promise<"sent" | "failed" | "escalated" | "skipped"> {
  const entry = doc.data() as ConversionLogEntry;
  const locationId = entry.locationId ?? locationIdFromDocPath(doc.ref.path);
  const now = Date.now();

  if (entry.status !== "failed") return "skipped";
  if (entry.timestamp < now - WINDOW_MS) return "skipped";
  if (entry.nextRetryAt && entry.nextRetryAt > now) return "skipped";
  if (entry.attemptCount >= MAX_ATTEMPTS) return "skipped"; // already escalated or awaiting escalation below

  const contact = await getContact(locationId, entry.contactId);
  if (!contact) {
    await writeConversionLog(locationId, {
      ...entry,
      status: "failed",
      reason: "Retry failed: contact no longer found.",
      timestamp: now,
      attemptCount: entry.attemptCount + 1,
      lastAttemptAt: now,
      nextRetryAt: computeNextRetryAt(entry.attemptCount + 1, now),
    });
    return await maybeEscalate(locationId, entry, entry.attemptCount + 1);
  }

  const attribution = contact.lastAttributionSource ?? contact.attributionSource;
  const userData = buildUserData(contact, attribution);
  const eventId = entry.eventId ?? entry.entityId;

  const customData =
    entry.eventType === "closed_won"
      ? { value: entry.value ?? 0, currency: "USD", ad_id: entry.utmAdId }
      : { ad_id: entry.utmAdId };

  const result = await postConversionEvent({
    eventName: EVENT_NAME[entry.eventType],
    eventId,
    userData,
    customData,
  });

  const attemptCount = entry.attemptCount + 1;

  if (result.ok) {
    await writeConversionLog(locationId, {
      ...entry,
      status: "sent",
      reason: undefined,
      timestamp: now,
      attemptCount,
      lastAttemptAt: now,
      nextRetryAt: undefined,
    });
    return "sent";
  }

  await writeConversionLog(locationId, {
    ...entry,
    status: "failed",
    reason: result.detail,
    timestamp: now,
    attemptCount,
    lastAttemptAt: now,
    nextRetryAt: computeNextRetryAt(attemptCount, now),
  });

  return await maybeEscalate(locationId, entry, attemptCount);
}

/** AC5: after MAX_ATTEMPTS, this is ops escalation, not a user-visible error — a DLQ record plus an optional Slack ping. */
async function maybeEscalate(
  locationId: string,
  entry: ConversionLogEntry,
  attemptCount: number,
): Promise<"failed" | "escalated"> {
  if (attemptCount < MAX_ATTEMPTS) return "failed";
  if (entry.alertedAt) return "escalated"; // already alerted on a prior run

  const dlqId = await recordFailure({
    source: "meta_conversions",
    reason: "handler_error",
    payload: { locationId, eventType: entry.eventType, entityId: entry.entityId, contactId: entry.contactId },
    error: `Exhausted ${attemptCount} attempts delivering ${entry.eventType} conversion to Meta.`,
  });
  await flagForReview(dlqId, "meta-retry-job", "3 retries failed, ops needs to check Meta API health / credentials.");

  await writeConversionLog(locationId, {
    ...entry,
    status: "failed",
    attemptCount,
    lastAttemptAt: Date.now(),
    nextRetryAt: undefined,
    alertedAt: Date.now(),
  });

  if (slackConfigured()) {
    await postAlert(
      `Meta conversion delivery failed after ${attemptCount} attempts: ${entry.eventType} ${entry.entityId} (location ${locationId}). Recorded in dead-letter queue (${dlqId}).`,
    ).catch((err) => console.error("[meta/retry] Slack alert failed", err));
  }

  return "escalated";
}

/** Entry point for the scheduled retry route. Never throws — callers should still check the summary for stillFailed/escalated counts. */
export async function runMetaRetryJob(): Promise<RetryRunSummary> {
  const summary: RetryRunSummary = { scanned: 0, retried: 0, succeeded: 0, stillFailed: 0, escalated: 0 };
  const cutoff = Date.now() - WINDOW_MS;

  const snapshot = await firestore()
    .collectionGroup("metaConversionLog")
    .where("status", "==", "failed")
    .where("timestamp", ">=", cutoff)
    .get();

  summary.scanned = snapshot.size;

  for (const doc of snapshot.docs) {
    const outcome = await retryOne(doc);
    if (outcome === "skipped") continue;
    summary.retried += 1;
    if (outcome === "sent") summary.succeeded += 1;
    if (outcome === "failed") summary.stillFailed += 1;
    if (outcome === "escalated") {
      summary.stillFailed += 1;
      summary.escalated += 1;
    }
  }

  return summary;
}
