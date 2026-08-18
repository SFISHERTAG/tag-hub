// Client-safe types and pure functions for CSM client data.
// Firestore-backed fetchers live in csm-clients.ts (server-only).
import type { ClientHealth, HealthMetrics } from "./health-scoring";

export type EscalationBucket = "ascension-ready" | "at-risk" | "no-action-needed";

export interface ClientData {
  id: string;
  name: string;
  ghl_location_id: string;
  csm_assigned: string;
  health: ClientHealth;
  last_activity?: string;
  alert_count: number;
  metrics?: HealthMetrics;
  escalation: {
    bucket: EscalationBucket;
    reason: string | null;
    /** Days since the CSM last entered this tenant (story 3.5's audit log), or null if never. */
    daysSinceLastCheckIn: number | null;
  };
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
