import "server-only";
import { db } from "@/lib/firebase/admin";
import { calculateHealthScore, getStatusFromScore, type ClientHealth, type HealthMetrics } from "./health-scoring";
import { getMockMetrics } from "./mock-metrics";

export interface ClientData {
  id: string;
  name: string;
  ghl_location_id: string;
  csm_assigned: string;
  health: ClientHealth;
  last_activity?: string;
  alert_count: number;
  metrics?: HealthMetrics;
}

export interface ClientAlert {
  id: string;
  type: "critical" | "warning" | "info";
  title: string;
  message: string;
  created_at: string;
  resolved_at?: string;
}

/**
 * Fetch all clients assigned to a CSM.
 */
export async function getAssignedClients(csmEmail: string): Promise<ClientData[]> {
  try {
    const snapshot = await db
      .collection("clients")
      .where("csm_assigned", "==", csmEmail)
      .where("active", "==", true)
      .get();

    const clients: ClientData[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const clientId = doc.id;

      const metrics = getMockMetrics(clientId);
      const health = calculateHealthScore(metrics);
      health.clientId = clientId;

      const alerts = await getClientAlerts(clientId);
      health.alert_count = alerts.filter((a) => !a.resolved_at).length;

      clients.push({
        id: clientId,
        name: data.name || "Unknown Client",
        ghl_location_id: data.ghl_location_id,
        csm_assigned: data.csm_assigned,
        health,
        alert_count: health.alert_count,
        metrics,
      });
    }

    return clients.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Error fetching assigned clients:", error);
    return [];
  }
}

/**
 * Fetch alerts for a specific client.
 */
export async function getClientAlerts(clientId: string): Promise<ClientAlert[]> {
  try {
    const snapshot = await db
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
    const doc = await db.collection("clients").doc(clientId).get();

    if (!doc.exists) return null;

    const data = doc.data()!;
    const metrics = getMockMetrics(clientId);
    const health = calculateHealthScore(metrics);
    health.clientId = clientId;

    const alerts = await getClientAlerts(clientId);
    health.alert_count = alerts.filter((a) => !a.resolved_at).length;

    return {
      id: clientId,
      name: data.name,
      ghl_location_id: data.ghl_location_id,
      csm_assigned: data.csm_assigned,
      health,
      alert_count: health.alert_count,
      metrics,
    };
  } catch (error) {
    console.error(`Error fetching client ${clientId}:`, error);
    return null;
  }
}

/**
 * Filter and sort clients.
 */
export function filterClients(
  clients: ClientData[],
  options: {
    search?: string;
    statusFilter?: "all" | "excellent" | "healthy" | "at-risk" | "critical" | "alert";
    sortBy?: "name" | "health" | "roas" | "spend";
    sortOrder?: "asc" | "desc";
  },
): ClientData[] {
  let filtered = [...clients];

  // Search filter
  if (options.search && options.search.trim()) {
    const query = options.search.toLowerCase();
    filtered = filtered.filter((c) => c.name.toLowerCase().includes(query));
  }

  // Status filter
  if (options.statusFilter && options.statusFilter !== "all") {
    filtered = filtered.filter((c) => c.health.status === options.statusFilter);
  }

  // Sort
  const sortBy = options.sortBy || "name";
  const sortOrder = options.sortOrder || "asc";
  const multiplier = sortOrder === "asc" ? 1 : -1;

  filtered.sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name) * multiplier;
      case "health":
        return (a.health.score - b.health.score) * multiplier;
      case "roas":
        return ((a.metrics?.roas || 0) - (b.metrics?.roas || 0)) * multiplier;
      case "spend":
        return ((a.metrics?.spend || 0) - (b.metrics?.spend || 0)) * multiplier;
      default:
        return 0;
    }
  });

  return filtered;
}
