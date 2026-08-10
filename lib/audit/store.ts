import "server-only";
import { firestore } from "@/lib/firestore";

/**
 * Audit logging.
 *
 * Story 3.5 asks specifically for impersonation entry/exit: who entered which
 * client's account, when, and what they touched. That is not optional — it is
 * what answers a client asking who looked at their data.
 *
 * This module generalizes the shape beyond enter/exit so any server module
 * can record an accountable action (an admin changing a rules config, a
 * write made while impersonating, a manual DLQ resolution) through the same
 * append-only log, without inventing a new persistence pattern each time.
 * `logAction()` is the entry point most callers want; `saveAuditEvent` /
 * `getAuditEvents` are the lower-level read/write if you need them directly.
 *
 * Firestore collection: `locations/{locationId}/auditLog`, one document per
 * event. Immutable by convention — this module only ever adds documents,
 * never updates or deletes one. An impersonation *session* (entry time and,
 * later, exit time on the same record) is intentionally NOT modeled here as
 * a single mutable document — two immutable events ("impersonation.enter",
 * "impersonation.exit") carrying a shared `sessionId` in metadata give the
 * same query answer ("when did this session start and end") without an
 * update-in-place, which keeps every writer's job identical: append one
 * event, never fetch-modify-write.
 */

export type AuditEvent = {
  /** Who performed the action — the real, authenticated user, never an impersonated identity. */
  actorId: string;
  actorRole: string;
  /** e.g. "impersonation.enter", "impersonation.exit", "rules_config.update", "dlq.resolve". Namespaced with a dot, not a fixed union — new callers don't need to touch this file. */
  action: string;
  /** What the action was performed on, if anything. */
  targetType?: string;
  targetId?: string;
  /** Free-form context: old/new values on a config change, a DLQ entry id, etc. */
  metadata?: Record<string, unknown>;
  /** Epoch milliseconds. */
  timestamp: number;
};

/**
 * Append one audit event. Returns the new document id.
 * Server-side only — no client ever writes directly to the audit log.
 */
export async function saveAuditEvent(locationId: string, event: AuditEvent): Promise<string> {
  const doc = await firestore().collection(`locations/${locationId}/auditLog`).add(event);
  return doc.id;
}

/**
 * The general-purpose call site: fills `timestamp` for you and appends.
 *
 * @example
 * await logAction(locationId, {
 *   actorId: session.uid,
 *   actorRole: session.role,
 *   action: "impersonation.enter",
 *   targetType: "tenant",
 *   targetId: locationId,
 * });
 */
export async function logAction(locationId: string, event: Omit<AuditEvent, "timestamp">): Promise<string> {
  return saveAuditEvent(locationId, { ...event, timestamp: Date.now() });
}

export async function getAuditEvents(
  locationId: string,
  filter?: { actorId?: string; action?: string },
): Promise<AuditEvent[]> {
  let query = firestore()
    .collection(`locations/${locationId}/auditLog`)
    .orderBy("timestamp", "desc")
    .limit(100);

  if (filter?.actorId) query = query.where("actorId", "==", filter.actorId);
  if (filter?.action) query = query.where("action", "==", filter.action);

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => doc.data() as AuditEvent);
}

/** Days since the most recent matching event, or null if there are none. Used by story 3.6's "no CSM check-in for 30+ days" rule. */
export async function daysSinceLastAction(locationId: string, action: string): Promise<number | null> {
  const [latest] = await getAuditEvents(locationId, { action });
  if (!latest) return null;
  return Math.floor((Date.now() - latest.timestamp) / (1000 * 60 * 60 * 24));
}
