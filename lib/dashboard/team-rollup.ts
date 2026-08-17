// Client-safe aggregation over ClientData — no Firestore imports here.
// Feeds the team_health_rollup (CSD) and department_overview (exec) widgets.
import type { ClientData } from "./csm-clients-types";

export type CsmBookSummary = {
  csmEmail: string;
  clientCount: number;
  excellent: number;
  healthy: number;
  atRisk: number;
  critical: number;
  alert: number;
  avgHealthScore: number;
  /** From escalation.config.ts — see EscalationView (app/csm-dashboard/views/escalation-view.tsx). */
  ascensionReadyCount: number;
  escalationAtRiskCount: number;
};

export type DepartmentSummary = {
  totalClients: number;
  csmCount: number;
  avgHealthScore: number;
  /** at-risk + critical + alert, per health-scoring.ts's status buckets. */
  needsAttentionCount: number;
  ascensionReadyCount: number;
  escalationAtRiskCount: number;
  /** Worst-average-score books first — where a CSD should look first. */
  booksByRisk: CsmBookSummary[];
};

/** Group a flat client list by the CSM who owns each one. */
export function summarizeByCsm(clients: ClientData[]): CsmBookSummary[] {
  const byCsm = new Map<string, ClientData[]>();
  for (const client of clients) {
    const list = byCsm.get(client.csm_assigned) ?? [];
    list.push(client);
    byCsm.set(client.csm_assigned, list);
  }

  const summaries: CsmBookSummary[] = [];
  for (const [csmEmail, book] of byCsm) {
    const statusCounts = { excellent: 0, healthy: 0, "at-risk": 0, critical: 0, alert: 0 };
    let scoreTotal = 0;
    let ascensionReadyCount = 0;
    let escalationAtRiskCount = 0;
    for (const client of book) {
      statusCounts[client.health.status] += 1;
      scoreTotal += client.health.score;
      if (client.escalation.bucket === "ascension-ready") ascensionReadyCount += 1;
      if (client.escalation.bucket === "at-risk") escalationAtRiskCount += 1;
    }
    summaries.push({
      csmEmail,
      clientCount: book.length,
      excellent: statusCounts.excellent,
      healthy: statusCounts.healthy,
      atRisk: statusCounts["at-risk"],
      critical: statusCounts.critical,
      alert: statusCounts.alert,
      avgHealthScore: book.length > 0 ? Math.round(scoreTotal / book.length) : 0,
      ascensionReadyCount,
      escalationAtRiskCount,
    });
  }

  return summaries.sort((a, b) => a.avgHealthScore - b.avgHealthScore);
}

/** Department-wide rollup — same input either scoped to one CSD's team or every active client. */
export function summarizeDepartment(clients: ClientData[]): DepartmentSummary {
  const booksByRisk = summarizeByCsm(clients);
  const scoreTotal = clients.reduce((sum, c) => sum + c.health.score, 0);
  const needsAttentionCount = clients.filter(
    (c) => c.health.status === "at-risk" || c.health.status === "critical" || c.health.status === "alert",
  ).length;

  return {
    totalClients: clients.length,
    csmCount: booksByRisk.length,
    avgHealthScore: clients.length > 0 ? Math.round(scoreTotal / clients.length) : 0,
    needsAttentionCount,
    ascensionReadyCount: booksByRisk.reduce((sum, b) => sum + b.ascensionReadyCount, 0),
    escalationAtRiskCount: booksByRisk.reduce((sum, b) => sum + b.escalationAtRiskCount, 0),
    booksByRisk,
  };
}
