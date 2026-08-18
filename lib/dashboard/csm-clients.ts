import "server-only";
import { firestore } from "@/lib/firestore";
import { calculateHealthScore, getStatusFromScore, type ClientHealth, type HealthMetrics } from "./health-scoring";
import { getMockMetrics } from "./mock-metrics";
import { getTeamEmails } from "./csm-directory";
import { evaluateRules } from "@/lib/rules/engine";
import { escalationRules } from "@/lib/rules/configs/escalation.config";
import { daysSinceLastAction } from "@/lib/audit/store";
import type { ClientData, ClientAlert, EscalationBucket } from "./csm-clients-types";
import type { CollectionReference, DocumentSnapshot, Query, QueryDocumentSnapshot } from "@google-cloud/firestore";

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
  const daysSinceLastCheckIn = await daysSinceLastAction(locationId, "impersonation");

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
  doc: QueryDocumentSnapshot | DocumentSnapshot,
): Promise<ClientData | null> {
  const data = doc.data();
  if (!data) return null;
  const clientId = doc.id;

  const metrics = getMockMetrics(clientId);
  const health = calculateHealthScore(metrics);
  health.clientId = clientId;

  const alerts = await getClientAlerts(clientId);
  health.alert_count = alerts.filter((a) => !a.resolved_at).length;

  const escalation = await computeEscalation(
    data.ghl_location_id,
    Boolean(data.upsell_attempted),
    health.status,
  );

  return {
    id: clientId,
    name: data.name || "Unknown Client",
    ghl_location_id: data.ghl_location_id,
    csm_assigned: data.csm_assigned,
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
  query: Query | CollectionReference,
): Promise<ClientData[]> {
  const snapshot = await query.get();
  const clients = (await Promise.all(snapshot.docs.map((doc) => buildClientData(doc)))).filter(
    (c): c is ClientData => c !== null,
  );

  return clients.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fetch all clients assigned to a CSM — their own book, the default scope.
 */
export async function getAssignedClients(csmEmail: string): Promise<ClientData[]> {
  try {
    return await fetchClients(
      firestore()
        .collection("clients")
        .where("csm_assigned", "==", csmEmail)
        .where("active", "==", true),
    );
  } catch (error) {
    console.error("Error fetching assigned clients:", error);
    return [];
  }
}

/**
 * Fetch clients across every CSM reporting to this CSD — the department
 * rollup a CS Director sees. Batches the `csm_assigned in [...]` filter in
 * groups of 30 (Firestore's `in` limit) since a department can exceed it.
 */
export async function getTeamClients(csdEmail: string): Promise<ClientData[]> {
  try {
    const csmEmails = await getTeamEmails(csdEmail);
    if (csmEmails.length === 0) return [];

    const batches: string[][] = [];
    for (let i = 0; i < csmEmails.length; i += FIRESTORE_IN_LIMIT) {
      batches.push(csmEmails.slice(i, i + FIRESTORE_IN_LIMIT));
    }

    const results = await Promise.all(
      batches.map((batch) =>
        fetchClients(
          firestore()
            .collection("clients")
            .where("csm_assigned", "in", batch)
            .where("active", "==", true),
        ),
      ),
    );

    return results.flat().sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error(`Error fetching team clients for CSD ${csdEmail}:`, error);
    return [];
  }
}

/**
 * Fetch every active client — the boardroom view. Exec-only; callers must
 * gate on role before calling this, same as `requireLocationAccess` does for
 * GHL data.
 */
export async function getDepartmentClients(): Promise<ClientData[]> {
  try {
    return await fetchClients(firestore().collection("clients").where("active", "==", true));
  } catch (error) {
    console.error("Error fetching department clients:", error);
    return [];
  }
}

/**
 * Fetch another CSM's book by their email — the "jump in and help" coverage
 * path. Deliberately not owner-gated: any internal role (tag_csm/tag_csd/
 * tag_exec) can pull up a peer's book. Callers surface this as an explicit
 * "view another CSM's book" picker rather than silently merging it into
 * "my book," so coverage stays visible as coverage.
 */
export async function getClientsForCsm(targetEmail: string): Promise<ClientData[]> {
  return getAssignedClients(targetEmail);
}

/**
 * Fetch alerts for a specific client.
 */
export async function getClientAlerts(clientId: string): Promise<ClientAlert[]> {
  try {
    const snapshot = await firestore()
      .collection("clients")
      .doc(clientId)
      .collection("alerts")
      .orderBy("created_at", "desc")
      .limit(50)
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      type: doc.data().type,
      title: doc.data().title,
      message: doc.data().message,
      created_at: doc.data().created_at,
      resolved_at: doc.data().resolved_at,
    }));
  } catch (error) {
    console.error(`Error fetching alerts for client ${clientId}:`, error);
    return [];
  }
}

/**
 * Fetch a single client with full details.
 */
export async function getClientDetail(clientId: string): Promise<ClientData | null> {
  try {
    const doc = await firestore().collection("clients").doc(clientId).get();
    if (!doc.exists) return null;
    return await buildClientData(doc);
  } catch (error) {
    console.error(`Error fetching client ${clientId}:`, error);
    return null;
  }
}

/**
 * Mark (or clear) that a CSM has attempted an upsell conversation with this
 * client — the one escalation input with no automatic source yet (see
 * computeEscalation above). Manual today; the natural place to derive this
 * automatically once an activity log exists.
 */
export async function setUpsellAttempted(clientId: string, attempted: boolean): Promise<void> {
  await firestore().collection("clients").doc(clientId).set({ upsell_attempted: attempted }, { merge: true });
}
