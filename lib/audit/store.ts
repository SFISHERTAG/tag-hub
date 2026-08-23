import "server-only";
import { repository } from "@/lib/data";

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
  return repository().auditLog(locationId).add(event);
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
  const where = [];
  if (filter?.actorId) where.push({ field: "actorId" as const, op: "==" as const, value: filter.actorId });
  if (filter?.action) where.push({ field: "action" as const, op: "==" as const, value: filter.action });

  const found = await repository().auditLog(locationId).list({
    where,
    orderBy: { field: "timestamp", direction: "desc" },
    limit: 100,
  });
  return found.map(({ data }) => data);
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
  return repository().auditLog(locationId).add({
    actorId,
    actorRole,
    action: "impersonation",
    targetType: "tenant",
    targetId: locationId,
    entryTimestamp,
    exitTimestamp: null,
    timestamp: entryTimestamp,
  } satisfies ImpersonationEntry);
}

/**
 * Story 3.5 AC3 — updates the same document `createImpersonationEntry` made
 * with an exit time. Never creates a second document.
 *
 * `actorId` is required and verified, because every argument here arrives from
 * the `hub_impersonation` cookie, which is unsigned. httpOnly stops page
 * scripts reading it; it does nothing about a crafted request. Without an
 * ownership check this was a bare `.update()` against any document id under any
 * location, so an authenticated user could stamp an exit time onto another
 * person's open impersonation entry — closing a record of access that was still
 * live, which is precisely the trail Story 3.5 exists to keep.
 *
 * Returns whether an entry was actually closed. A caller must not treat false
 * as fatal (the cookie may simply be stale) but must not report success either.
 */
export async function closeImpersonationEntry(
  locationId: string,
  entryId: string,
  actorId: string,
): Promise<boolean> {
  const ref = repository().auditLog(locationId).doc(entryId);

  return repository().transaction(async (tx) => {
    const data = await ref.get(tx);
    if (!data) return false;

    // Shape and ownership, both required. The action check stops an arbitrary
    // audit document of another kind being stamped; the actor check stops one
    // user closing another's entry.
    if (data.action !== "impersonation") return false;
    if (data.actorId !== actorId) return false;
    // Already closed. Re-stamping would overwrite the real exit time with a
    // later one, understating how long the access lasted.
    if (data.exitTimestamp !== null) return false;

    await ref.update({ exitTimestamp: Date.now() }, tx);
    return true;
  });
}
