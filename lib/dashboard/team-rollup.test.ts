import { describe, it, expect } from "vitest";
import { evaluateRules } from "@/lib/rules/engine";
import { escalationRules } from "@/lib/rules/configs/escalation.config";
import { summarizeByCsm, summarizeDepartment } from "./team-rollup";
import type { ClientData } from "./csm-clients-types";

function client(overrides: Partial<ClientData> & Pick<ClientData, "id" | "csm_assigned" | "escalation">): ClientData {
  return {
    name: overrides.id,
    ghl_location_id: "loc_1",
    health: { clientId: overrides.id, score: 80, status: "healthy", roas_score: 80, spend_score: 80, leads_score: 80, sla_score: 80, alert_count: 0, last_updated: new Date().toISOString() },
    alert_count: 0,
    ...overrides,
  };
}

describe("escalationRules (story 3.6 buckets)", () => {
  it("buckets a stalled check-in as at-risk", () => {
    const evaluation = evaluateRules(escalationRules, { daysSinceLastCheckIn: 45, upsellAttempted: false });
    expect(evaluation.bucket).toBe("at-risk");
  });

  it("falls through to no-action-needed when nothing matches", () => {
    const evaluation = evaluateRules(escalationRules, { daysSinceLastCheckIn: 5, upsellAttempted: true });
    expect(evaluation.bucket).toBe("no-action-needed");
  });

  it("never fires ascension-ready without a healthy signal (documented, not yet wired for showRatePct)", () => {
    const evaluation = evaluateRules(escalationRules, { daysSinceLastCheckIn: 5, upsellAttempted: false });
    expect(evaluation.bucket).not.toBe("ascension-ready");
  });

  it("fires ascension-ready when healthy and no upsell attempted", () => {
    const evaluation = evaluateRules(escalationRules, { healthy: true, upsellAttempted: false });
    expect(evaluation.bucket).toBe("ascension-ready");
  });

  it("fires at-risk on critical health regardless of check-in recency", () => {
    const evaluation = evaluateRules(escalationRules, { criticalHealth: true, daysSinceLastCheckIn: 0 });
    expect(evaluation.bucket).toBe("at-risk");
  });
});

describe("summarizeByCsm / summarizeDepartment", () => {
  const clients: ClientData[] = [
    client({ id: "a", csm_assigned: "csm1@tag.com", escalation: { bucket: "at-risk", reason: "x", daysSinceLastCheckIn: 45 } }),
    client({ id: "b", csm_assigned: "csm1@tag.com", escalation: { bucket: "no-action-needed", reason: null, daysSinceLastCheckIn: 5 } }),
    client({ id: "c", csm_assigned: "csm2@tag.com", escalation: { bucket: "ascension-ready", reason: "y", daysSinceLastCheckIn: null } }),
  ];

  it("groups clients by their assigned CSM", () => {
    const books = summarizeByCsm(clients);
    expect(books).toHaveLength(2);
    const csm1 = books.find((b) => b.csmEmail === "csm1@tag.com")!;
    expect(csm1.clientCount).toBe(2);
    expect(csm1.escalationAtRiskCount).toBe(1);
  });

  it("rolls escalation bucket counts up to the department summary", () => {
    const summary = summarizeDepartment(clients);
    expect(summary.totalClients).toBe(3);
    expect(summary.csmCount).toBe(2);
    expect(summary.ascensionReadyCount).toBe(1);
    expect(summary.escalationAtRiskCount).toBe(1);
  });
});
