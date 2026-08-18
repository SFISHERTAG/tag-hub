import "server-only";
import { createHash } from "node:crypto";
import { firestore } from "@/lib/firestore";
import { getContact, type Attribution, type Contact } from "@/lib/ghl/contacts";

/**
 * Meta Conversions API — server-side conversion events.
 *
 * Story 6.2: when a closer marks an appointment "showed", Meta's learning
 * algorithm should hear about it. Without this, the algo only ever sees
 * form-submit conversions and optimizes toward people who fill out forms,
 * not people who actually show up and buy — the opposite of what TAG wants
 * it to chase.
 *
 * Story 6.3: same idea, one rung up the funnel — when an opportunity closes
 * won, Meta should hear the deal's value, not just that a close happened.
 * dispatchShowed and dispatchClosedWon share the hashing, user_data
 * assembly, and event-post logic below (buildUserData / postConversionEvent)
 * since only event_name, value, and trigger point differ between them.
 *
 * Story 6.5: neither dispatch function may block on delivery confirmation —
 * both still catch their own errors and never throw — but every attempt is
 * now logged with enough state (attemptCount, lastAttemptAt, nextRetryAt)
 * for lib/meta/retry.ts to find and retry failures on a schedule, using the
 * same eventId so a retry after Meta actually received the original (but
 * the HTTP response was lost) lands as a no-op dedup on Meta's side rather
 * than a duplicate conversion.
 *
 * Both must never be able to fail the work that triggers them (2.3's outcome
 * save, 2.6's opportunity close): every path through either function catches
 * its own errors, logs them, and returns without throwing. Callers should
 * treat both as fire-and-forget.
 */

const GRAPH_VERSION = "v21.0";

export type ConversionEventType = "showed" | "closed_won";

/**
 * pending: dispatch is in flight (written before the Meta call so a crash
 *   mid-call still leaves a retryable record instead of no record at all).
 * sent: Meta's response body confirmed events_received >= 1.
 * failed: the HTTP call errored, or Meta responded without confirming
 *   receipt — eligible for lib/meta/retry.ts until attemptCount hits
 *   MAX_ATTEMPTS.
 * skipped: dispatch never reached Meta (missing config, no contact, no ad
 *   attribution) — not a delivery failure, so not retried on a schedule.
 */
export type ConversionStatus = "pending" | "sent" | "failed" | "skipped";

/** Initial dispatch + up to this many retries before Story 6.5's AC5 alert fires. */
export const MAX_ATTEMPTS = 4;

/** Backoff between retry attempts, indexed by number of retries already made (0, 1, 2). */
export const RETRY_BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000];

export type ConversionLogEntry = {
  locationId: string;
  eventType: ConversionEventType;
  /** appointmentId for "showed", opportunityId for "closed_won". */
  entityId: string;
  contactId: string;
  status: ConversionStatus;
  reason?: string;
  utmAdId?: string;
  eventId?: string;
  value?: number;
  /** Epoch ms of the most recent write to this doc. */
  timestamp: number;
  /** Epoch ms of the first dispatch attempt. Preserved across retries. */
  createdAt: number;
  /** How many times a send has been attempted, including the original dispatch. */
  attemptCount: number;
  /** Epoch ms of the most recent send attempt. */
  lastAttemptAt: number;
  /** Epoch ms after which a retry is eligible. Absent once attempts are exhausted or the event isn't "failed". */
  nextRetryAt?: number;
  /** Epoch ms the AC5 escalation alert was recorded, set once so retries don't re-alert. */
  alertedAt?: number;
};

export function conversionLogDoc(locationId: string, entry: Pick<ConversionLogEntry, "eventType" | "entityId">) {
  // Prefixed by eventType so a "showed" appointmentId and a "closed_won"
  // opportunityId can never collide on the same doc id within one location.
  return `locations/${locationId}/metaConversionLog/${entry.eventType}_${entry.entityId}`;
}

async function writeLog(
  locationId: string,
  entry: Omit<ConversionLogEntry, "createdAt"> & { createdAt?: number },
): Promise<void> {
  try {
    const now = Date.now();
    await firestore()
      .doc(conversionLogDoc(locationId, entry))
      .set({ ...entry, createdAt: entry.createdAt ?? now }, { merge: true });
  } catch (error) {
    // The dispatch already happened (or didn't) by the time logging fails;
    // losing the audit trail entry is not worth surfacing further.
    console.error("[meta/conversions] failed to write audit log", error);
  }
}

function hashForMeta(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/** Which env vars a Conversions API call needs. Empty means fully configured. */
export function conversionsMissingConfig(): string[] {
  const missing: string[] = [];
  if (!process.env.META_PIXEL_ID) missing.push("META_PIXEL_ID");
  if (!process.env.META_SYSTEM_USER_TOKEN) missing.push("META_SYSTEM_USER_TOKEN");
  return missing;
}

export type MetaUserData = {
  em?: string[];
  ph?: string[];
  fbc?: string;
  fbp?: string;
};

/** Hashed email/phone plus raw fbc/fbp — the user_data shape Meta expects. */
export function buildUserData(contact: Contact, attribution: Attribution | undefined): MetaUserData {
  const userData: MetaUserData = {};
  if (contact.email) userData.em = [hashForMeta(contact.email)];
  if (contact.phone) userData.ph = [hashForMeta(contact.phone)];
  if (attribution?.fbc) userData.fbc = attribution.fbc;
  if (attribution?.fbp) userData.fbp = attribution.fbp;
  return userData;
}

type PostResult =
  | { ok: true }
  | { ok: false; detail: string };

/**
 * POSTs one event to the Conversions API and confirms Meta actually
 * received it — a 2xx alone is not enough. Meta's response body carries
 * `events_received` (a count); anything less than 1, or a non-2xx status,
 * counts as a delivery failure (Story 6.5 AC2/AC3).
 */
export async function postConversionEvent(params: {
  eventName: string;
  eventId: string;
  userData: MetaUserData;
  customData?: Record<string, unknown>;
}): Promise<PostResult> {
  const pixelId = process.env.META_PIXEL_ID!;
  const accessToken = process.env.META_SYSTEM_USER_TOKEN!;

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: accessToken,
        data: [
          {
            event_name: params.eventName,
            event_time: Math.floor(Date.now() / 1000),
            event_id: params.eventId,
            action_source: "system_generated",
            user_data: params.userData,
            ...(params.customData ? { custom_data: params.customData } : {}),
          },
        ],
      }),
    },
  );

  const bodyText = await response.text().catch(() => "");

  if (!response.ok) {
    return { ok: false, detail: `Meta API ${response.status}: ${bodyText}` };
  }

  let parsed: { events_received?: number } = {};
  try {
    parsed = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    return { ok: false, detail: `Meta API ${response.status}: unparseable response body: ${bodyText}` };
  }

  if (!parsed.events_received || parsed.events_received < 1) {
    return { ok: false, detail: `Meta API ${response.status}: events_received=${parsed.events_received ?? 0}: ${bodyText}` };
  }

  return { ok: true };
}

function nextRetryAt(attemptCount: number, lastAttemptAt: number): number | undefined {
  const retriesDone = attemptCount - 1;
  if (retriesDone >= RETRY_BACKOFF_MS.length) return undefined;
  return lastAttemptAt + RETRY_BACKOFF_MS[retriesDone];
}

/**
 * Fetches the contact, extracts attribution, and sends a "ViewContent"
 * conversion event to Meta for an appointment marked "showed".
 *
 * Never throws. Every exit path (missing config, missing contact, missing
 * ad attribution, a failed HTTP call) is logged to Firestore for Story 3.5's
 * audit trail and, on failure, to the console as an alert — but always
 * returns normally so the caller's own work is never at risk.
 */
export async function dispatchShowed(
  locationId: string,
  appointmentId: string,
  contactId: string,
): Promise<void> {
  const base = { locationId, eventType: "showed" as const, entityId: appointmentId, contactId };
  try {
    const missing = conversionsMissingConfig();
    if (missing.length > 0) {
      await writeLog(locationId, {
        ...base,
        status: "skipped",
        reason: `Meta Conversions API not configured. Missing: ${missing.join(", ")}`,
        timestamp: Date.now(),
        attemptCount: 0,
        lastAttemptAt: Date.now(),
      });
      return;
    }

    const contact = await getContact(locationId, contactId);
    if (!contact) {
      await writeLog(locationId, {
        ...base,
        status: "skipped",
        reason: "Contact not found.",
        timestamp: Date.now(),
        attemptCount: 0,
        lastAttemptAt: Date.now(),
      });
      return;
    }

    const attribution = contact.lastAttributionSource ?? contact.attributionSource;
    const utmAdId = attribution?.utmAdId;

    if (!utmAdId) {
      await writeLog(locationId, {
        ...base,
        status: "skipped",
        reason: "No utmAdId on contact attribution.",
        timestamp: Date.now(),
        attemptCount: 0,
        lastAttemptAt: Date.now(),
      });
      return;
    }

    const attemptAt = Date.now();
    await writeLog(locationId, {
      ...base,
      status: "pending",
      utmAdId,
      eventId: appointmentId,
      timestamp: attemptAt,
      attemptCount: 1,
      lastAttemptAt: attemptAt,
    });

    const userData = buildUserData(contact, attribution);
    const result = await postConversionEvent({
      eventName: "ViewContent",
      eventId: appointmentId,
      userData,
      customData: { ad_id: utmAdId },
    });

    if (!result.ok) {
      console.error(`[meta/conversions] dispatch failed for appointment ${appointmentId}: ${result.detail}`);
      await writeLog(locationId, {
        ...base,
        status: "failed",
        reason: result.detail,
        utmAdId,
        eventId: appointmentId,
        timestamp: Date.now(),
        attemptCount: 1,
        lastAttemptAt: attemptAt,
        nextRetryAt: nextRetryAt(1, attemptAt),
      });
      return;
    }

    await writeLog(locationId, {
      ...base,
      status: "sent",
      utmAdId,
      eventId: appointmentId,
      timestamp: Date.now(),
      attemptCount: 1,
      lastAttemptAt: attemptAt,
    });
  } catch (error) {
    console.error(`[meta/conversions] unexpected error dispatching showed conversion for appointment ${appointmentId}`, error);
    const attemptAt = Date.now();
    await writeLog(locationId, {
      ...base,
      status: "failed",
      reason: error instanceof Error ? error.message : String(error),
      timestamp: attemptAt,
      attemptCount: 1,
      lastAttemptAt: attemptAt,
      nextRetryAt: nextRetryAt(1, attemptAt),
    }).catch(() => {});
  }
}

/**
 * Sends a "Purchase" conversion event to Meta for an opportunity marked
 * closed won, carrying its deal value so the algorithm learns to chase
 * high-ticket closes, not just closes.
 *
 * `value` must be a non-negative integer USD amount. Per Story 6.3's dev
 * notes, 0 is a real, meaningful value ("closed but low-ticket") and is
 * still sent — it is only rejected (skipped, not thrown) when negative or
 * non-integer, which signals a bad caller rather than a legitimate close.
 *
 * Same non-blocking contract as dispatchShowed: never throws, always logs.
 */
export async function dispatchClosedWon(
  locationId: string,
  opportunityId: string,
  contact: Contact,
  value: number,
): Promise<void> {
  const base = { locationId, eventType: "closed_won" as const, entityId: opportunityId, contactId: contact.id };
  try {
    if (!Number.isInteger(value) || value < 0) {
      console.error(`[meta/conversions] invalid value for opportunity ${opportunityId}: ${value}`);
      await writeLog(locationId, {
        ...base,
        status: "skipped",
        reason: `Invalid value: ${value}. Must be a non-negative integer USD amount.`,
        timestamp: Date.now(),
        attemptCount: 0,
        lastAttemptAt: Date.now(),
      });
      return;
    }

    const missing = conversionsMissingConfig();
    if (missing.length > 0) {
      await writeLog(locationId, {
        ...base,
        status: "skipped",
        reason: `Meta Conversions API not configured. Missing: ${missing.join(", ")}`,
        value,
        timestamp: Date.now(),
        attemptCount: 0,
        lastAttemptAt: Date.now(),
      });
      return;
    }

    const attribution = contact.lastAttributionSource ?? contact.attributionSource;
    const utmAdId = attribution?.utmAdId;

    if (!utmAdId) {
      await writeLog(locationId, {
        ...base,
        status: "skipped",
        reason: "No utmAdId on contact attribution.",
        value,
        timestamp: Date.now(),
        attemptCount: 0,
        lastAttemptAt: Date.now(),
      });
      return;
    }

    const attemptAt = Date.now();
    await writeLog(locationId, {
      ...base,
      status: "pending",
      utmAdId,
      eventId: opportunityId,
      value,
      timestamp: attemptAt,
      attemptCount: 1,
      lastAttemptAt: attemptAt,
    });

    const userData = buildUserData(contact, attribution);
    const result = await postConversionEvent({
      eventName: "Purchase",
      eventId: opportunityId,
      userData,
      customData: { value, currency: "USD", ad_id: utmAdId },
    });

    if (!result.ok) {
      console.error(`[meta/conversions] dispatch failed for opportunity ${opportunityId}: ${result.detail}`);
      await writeLog(locationId, {
        ...base,
        status: "failed",
        reason: result.detail,
        utmAdId,
        eventId: opportunityId,
        value,
        timestamp: Date.now(),
        attemptCount: 1,
        lastAttemptAt: attemptAt,
        nextRetryAt: nextRetryAt(1, attemptAt),
      });
      return;
    }

    await writeLog(locationId, {
      ...base,
      status: "sent",
      utmAdId,
      eventId: opportunityId,
      value,
      timestamp: Date.now(),
      attemptCount: 1,
      lastAttemptAt: attemptAt,
    });
  } catch (error) {
    console.error(`[meta/conversions] unexpected error dispatching closed-won conversion for opportunity ${opportunityId}`, error);
    const attemptAt = Date.now();
    await writeLog(locationId, {
      ...base,
      status: "failed",
      reason: error instanceof Error ? error.message : String(error),
      value,
      timestamp: attemptAt,
      attemptCount: 1,
      lastAttemptAt: attemptAt,
      nextRetryAt: nextRetryAt(1, attemptAt),
    }).catch(() => {});
  }
}

/** Exported so lib/meta/retry.ts can compute the next eligible retry time without duplicating the backoff schedule. */
export { nextRetryAt as computeNextRetryAt, writeLog as writeConversionLog };
