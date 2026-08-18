import "server-only";
import { firestore } from "@/lib/firestore";

/**
 * Audit logging.
 *
 * Firestore collection: `locations/{locationId}/auditLog`. Two shapes live
 * in this collection:
 *
 * - Impersonation sessions (Story 3.5): one document per CSM enter/exit,
 *   created on entry and updated in place on exit (AC1-3 ask for this
 *   literally — "update same entry", not a second document). Append/update
 *   only: nothing in this file ever deletes a document, so Firestore's own
 *   semantics keep the log immutable.
 * - General audit events (`logAction`): append-only records of any other
 *   accountable action (a write made while impersonating, an admin config
 *   change, a manual DLQ resolution). A write made while impersonating
 *   carries `auditEntryId`, pointing back at the impersonation session
 *   document that produced it (AC4).
 */

export type AuditEvent = {
  /** Who performed the action — the real, authenticated user, never an impersonated identity. */
  actorId: string;
  actorRole: string;
  /** e.g. "opportunity.stage_change", "appointment.outcome", "rules_config.update". Namespaced with a dot, not a fixed union — new callers don't need to touch this file. */
  action: string;
  /** What the action was performed on, if anything. */
  targetType?: string;
  targetId?: string;
  /** Set when this action happened while the actor was impersonating a client tenant — the impersonation session doc id (Story 3.5 AC4). */
  auditEntryId?: string;
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
 *   actorRole: session.currentRole,
 *   action: "opportunity.stage_change",
 *   targetType: "opportunity",
 *   targetId: opportunityId,
 *   auditEntryId: impersonation?.auditEntryId,
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

export type ImpersonationEntry = {
  actorId: string;
  actorRole: string;
  action: "impersonation";
  targetType: "tenant";
  targetId: string;
  entryTimestamp: number;
  exitTimestamp: number | null;
  /** Mirrors entryTimestamp so this doc sorts alongside plain AuditEvents in getAuditEvents/daysSinceLastAction. */
  timestamp: number;
};

/**
 * Story 3.5 AC1-2 — creates the one document for an impersonation session.
 * Called from Story 3.3's enter action, before the impersonation cookie is
 * set, so a crash between the two never grants access without a trail.
 */
export async function createImpersonationEntry(
  locationId: string,
  actorId: string,
  actorRole: string,
): Promise<string> {
  const entryTimestamp = Date.now();
  const doc = await firestore()
    .collection(`locations/${locationId}/auditLog`)
    .add({
      actorId,
      actorRole,
      action: "impersonation",
      targetType: "tenant",
      targetId: locationId,
      entryTimestamp,
      exitTimestamp: null,
      timestamp: entryTimestamp,
    } satisfies ImpersonationEntry);
  return doc.id;
}

/**
 * Story 3.5 AC3 — updates the same document from `createImpersonationEntry`
 * with an exit time. Never creates a second document. Called from Story
 * 3.4's exit action.
 */
export async function closeImpersonationEntry(locationId: string, entryId: string): Promise<void> {
  await firestore()
    .collection(`locations/${locationId}/auditLog`)
    .doc(entryId)
    .update({ exitTimestamp: Date.now() });
}
