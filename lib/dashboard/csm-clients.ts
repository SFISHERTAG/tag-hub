/*
 * The `import/no-restricted-paths` disable that stood here is gone: the data
 * path now runs through the `lib/data` repository seam (story 14.1), so the
 * zone no longer fires and eslint reported the directive as unused. Sixth and
 * last of these across the migration.
 *
 * The concern it recorded is NOT resolved and is kept deliberately. This still
 * queries directly instead of going through a scoped metric fetch, which is the
 * pattern the zone exists to stop. The remaining move is into
 * lib/dashboard/metrics.ts. See docs/ROLE_SCOPE_MODEL.md.
 */
import "server-only";
import { repository } from "@/lib/data";
import type { StoredClient, Where } from "@/lib/data";
import { withErrorHandling, type ApiResult } from "@/lib/api/errorInterceptor";
import { calculateHealthScore, getStatusFromScore, type ClientHealth, type HealthMetrics } from "./health-scoring";
import { getMockMetrics } from "./mock-metrics";
import { getTeamEmails } from "./csm-directory";
import { evaluateRules } from "@/lib/rules/engine";
import { escalationRules } from "@/lib/rules/configs/escalation.config";
import { daysSinceLastAction } from "@/lib/audit/store";
import type { ClientData, ClientAlert, EscalationBucket } from "./csm-clients-types";

export type { ClientData, ClientAlert };

/** Firestore's `in` operator caps at 30 values — fine for a CS team, not for the whole department. */
const FIRESTORE_IN_LIMIT = 30;

/**
 * Bucket a client via lib/rules/configs/escalation.config.ts.
 *
 * `showRatePct` and `deliveryStalled` are deliberately left out of the
 * snapshot — both would need a live per-client GHL fetch (calendar events
 * for the former, a resolved fulfillment-pipeline id for the latter) added
 * to what's today a pure-Firestore read path, and for the department-wide
 * rollup that's dozens of live GHL calls per page load. That's a real
 * integration with its own rate-limit/caching shape, not a two-line add —
 * left for a follow-up. Per lib/rules/engine.ts, a missing field just fails
 * that condition rather than throwing or misclassifying, so this evaluates
 * safely today; it just can't produce "ascension-ready" or the show-rate/
 * delivery branches of "at-risk" until that follow-up lands.
 */
async function computeEscalation(
  locationId: string,
  upsellAttempted: boolean,
  healthStatus: ClientHealth["status"],
): Promise<ClientData["escalation"]> {
  // No audit entries means the CSM has never entered this tenant yet, i.e. fresh
  // onboarding — treated as "not stale" rather than infinitely stale (see Dev notes).
  //
  // A client with no ghl_location_id skips the lookup entirely. It used to be
  // called with whatever the document held, so a missing location produced the
  // path `locations/undefined/auditLog`: a valid path that matches nothing, so
  // the answer looked like "never checked in" rather than "cannot tell". An
  // empty string is worse still, since `locations//auditLog` has an empty
  // segment and is rejected outright. Neither is a check-in history.
  const daysSinceLastCheckIn = locationId
    ? await daysSinceLastAction(locationId, "impersonation")
    : null;

  const evaluation = evaluateRules(escalationRules, {
    daysSinceLastCheckIn: daysSinceLastCheckIn ?? undefined,
    upsellAttempted,
    criticalHealth: healthStatus === "critical",
    healthy: healthStatus === "excellent" || healthStatus === "healthy",
  });

  return {
    bucket: evaluation.bucket as EscalationBucket,
    reason: evaluation.matchedRuleLabel,
    daysSinceLastCheckIn,
  };
}

async function buildClientData(
  clientId: string,
  data: StoredClient | null,
): Promise<ClientData | null> {
  if (!data) return null;

  const metrics = getMockMetrics(clientId);
  const health = calculateHealthScore(metrics);
  health.clientId = clientId;

  // A failed alert fetch degrades this one client's alert_count to 0 rather
  // than failing the whole list — alerts are a supplementary annotation, not
  // the client's core identity/health data. The failure is still logged
  // inside withErrorHandling, it just isn't fatal to the surrounding list.
  const alertsResult = await getClientAlerts(clientId);
  const alerts = alertsResult.data ?? [];
  health.alert_count = alerts.filter((a) => !a.resolved_at).length;

  // These two were passed straight through from an untyped snapshot, so a
  // client document missing either produced `undefined` in a field the view
  // model declares as a string, and every consumer downstream believed it.
  // Typing the collection surfaced it. computeEscalation now skips its audit
  // lookup when the location is absent rather than querying a malformed path.
  const ghlLocationId = data.ghl_location_id ?? "";
  const csmAssigned = data.csm_assigned ?? "";

  const escalation = await computeEscalation(
    ghlLocationId,
    Boolean(data.upsell_attempted),
    health.status,
  );

  return {
    id: clientId,
    name: data.name || "Unknown Client",
    ghl_location_id: ghlLocationId,
    csm_assigned: csmAssigned,
    health,
    alert_count: health.alert_count,
    metrics,
    escalation,
  };
}

/**
 * Run a `clients` query and attach computed health + alert data to each doc.
 * Shared by every scope below (own book, team rollup, department rollup,
 * coverage lookup) so the per-client computation lives in exactly one place.
 */
async function fetchClients(
  where: readonly Where<StoredClient>[],
): Promise<ClientData[]> {
  // Takes a filter, not a query object. This function used to accept a
  // Firestore `Query | CollectionReference`, so a Firestore type was in the
  // signature of the one function every CSM scope goes through, and four
  // Firestore types were imported at the top of this file.
  const found = await repository().clients.list({ where });
  const clients = (
    await Promise.all(found.map(({ id, data }) => buildClientData(id, data)))
  ).filter((c): c is ClientData => c !== null);

  return clients.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fetch all clients assigned to a CSM — their own book, the default scope.
 */
export async function getAssignedClients(csmEmail: string): Promise<ApiResult<ClientData[]>> {
  return withErrorHandling(`getAssignedClients(${csmEmail})`, () =>
    fetchClients([
      { field: "csm_assigned", op: "==", value: csmEmail },
      { field: "active", op: "==", value: true },
    ]),
  );
}

/**
 * Fetch clients across every CSM reporting to this CSD — the department
 * rollup a CS Director sees. Batches the `csm_assigned in [...]` filter in
 * groups of 30 (Firestore's `in` limit) since a department can exceed it.
 */
export async function getTeamClients(csdEmail: string): Promise<ApiResult<ClientData[]>> {
  return withErrorHandling(`getTeamClients(${csdEmail})`, async () => {
    const csmEmails = await getTeamEmails(csdEmail);
    if (csmEmails.length === 0) return [];

    const batches: string[][] = [];
    for (let i = 0; i < csmEmails.length; i += FIRESTORE_IN_LIMIT) {
      batches.push(csmEmails.slice(i, i + FIRESTORE_IN_LIMIT));
    }

    const results = await Promise.all(
      batches.map((batch) =>
        fetchClients([
          { field: "csm_assigned", op: "in", value: batch },
          { field: "active", op: "==", value: true },
        ]),
      ),
    );

    return results.flat().sort((a, b) => a.name.localeCompare(b.name));
  });
}

/**
 * Fetch every active client — the boardroom view. Exec-only; callers must
 * gate on role before calling this, same as `requireLocationAccess` does for
 * GHL data.
 */
export async function getDepartmentClients(): Promise<ApiResult<ClientData[]>> {
  return withErrorHandling("getDepartmentClients()", () =>
    fetchClients([{ field: "active", op: "==", value: true }]),
  );
}

/**
 * Fetch another CSM's book by their email — the "jump in and help" coverage
 * path. Deliberately not owner-gated: any internal role (tag_csm/tag_csd/
 * tag_exec) can pull up a peer's book. Callers surface this as an explicit
 * "view another CSM's book" picker rather than silently merging it into
 * "my book," so coverage stays visible as coverage.
 */
export async function getClientsForCsm(targetEmail: string): Promise<ApiResult<ClientData[]>> {
  return getAssignedClients(targetEmail);
}

/**
 * Fetch alerts for a specific client.
 */
export async function getClientAlerts(clientId: string): Promise<ApiResult<ClientAlert[]>> {
  return withErrorHandling(`getClientAlerts(${clientId})`, async () => {
    const found = await repository().clientAlerts(clientId).list({
      orderBy: { field: "created_at", direction: "desc" },
      limit: 50,
    });

    return found.map(({ id, data }) => ({
      id,
      type: data.type,
      title: data.title,
      message: data.message,
      created_at: data.created_at,
      resolved_at: data.resolved_at,
    }));
  });
}

/**
 * Fetch a single client with full details.
 */
export async function getClientDetail(clientId: string): Promise<ApiResult<ClientData | null>> {
  return withErrorHandling(`getClientDetail(${clientId})`, async () => {
    const data = await repository().clients.doc(clientId).get();
    if (!data) return null;
    return await buildClientData(clientId, data);
  });
}

/**
 * Mark (or clear) that a CSM has attempted an upsell conversation with this
 * client — the one escalation input with no automatic source yet (see
 * computeEscalation above). Manual today; the natural place to derive this
 * automatically once an activity log exists.
 */
export async function setUpsellAttempted(clientId: string, attempted: boolean): Promise<void> {
  await repository().clients.doc(clientId).set({ upsell_attempted: attempted }, { merge: true });
}
