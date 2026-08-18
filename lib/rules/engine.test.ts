import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { evaluateRules } from "./engine";
import { clientHealthRules } from "./configs/clientHealth.config";
import { escalationRules } from "./configs/escalation.config";

/**
 * Genericity proof: the exact same evaluateRules() runs both configs below.
 * They share almost no fields (only showRatePct) and have different bucket
 * sets (healthy/at-risk/critical vs. ascension-ready/at-risk/no-action-needed).
 * If a future change to engine.ts only makes sense for one of them, that's
 * the signal it stopped being generic — this test is the tripwire.
 */
describe("rules engine genericity proof", () => {
  it("evaluates client health: critical", () => {
    const result = evaluateRules(clientHealthRules, { showRatePct: 10 });
    expect(result.bucket).toBe("critical");
    expect(result.matchedRuleId).toBe("critical-show-rate");
  });

  it("evaluates client health: at-risk", () => {
    const result = evaluateRules(clientHealthRules, { showRatePct: 22 });
    expect(result.bucket).toBe("at-risk");
  });

  it("evaluates client health: healthy (default bucket)", () => {
    const result = evaluateRules(clientHealthRules, { showRatePct: 45 });
    expect(result.bucket).toBe("healthy");
    expect(result.matchedRuleId).toBeNull();
  });

  it("evaluates escalation: at-risk via any one of four independent conditions", () => {
    expect(evaluateRules(escalationRules, { criticalHealth: true }).bucket).toBe("at-risk");
    expect(evaluateRules(escalationRules, { showRatePct: 10 }).bucket).toBe("at-risk");
    expect(evaluateRules(escalationRules, { showRatePct: 50, deliveryStalled: true }).bucket).toBe("at-risk");
    expect(evaluateRules(escalationRules, { showRatePct: 50, daysSinceLastCheckIn: 31 }).bucket).toBe("at-risk");
  });

  it("evaluates escalation: ascension-ready requires healthy AND no upsell attempted (AND, not OR)", () => {
    const ready = evaluateRules(escalationRules, { healthy: true, upsellAttempted: false });
    expect(ready.bucket).toBe("ascension-ready");

    // Healthy but upsell already attempted should NOT read as ascension-ready.
    const alreadyUpsold = evaluateRules(escalationRules, { healthy: true, upsellAttempted: true });
    expect(alreadyUpsold.bucket).toBe("no-action-needed");
  });

  it("treats unwired fields (showRatePct, deliveryStalled) as absent without throwing", () => {
    const result = evaluateRules(escalationRules, { healthy: false, upsellAttempted: true });
    expect(result.bucket).toBe("no-action-needed");
    expect(result.missingFields).toContain("showRatePct");
  });

  it("throws a clear error on a config mistake (relational operator on a non-numeric value) instead of misclassifying", () => {
    const badConfig = {
      id: "bad",
      label: "bad",
      rules: [{ id: "x", label: "x", bucket: "x", when: [{ field: "status", operator: "lt" as const, value: "healthy" }] }],
      defaultBucket: "default",
    };
    expect(() => evaluateRules(badConfig, { status: "healthy" })).toThrow(/requires numeric values/);
  });

  it("enforces zero special-casing: engine.ts never names a client, tenant field, or bucket", () => {
    const source = readFileSync(fileURLToPath(new URL("./engine.ts", import.meta.url)), "utf-8");
    const lower = source.toLowerCase();
    for (const forbidden of ["tag", "cce", "showrate", "ascension", "at-risk", "critical", "healthy"]) {
      expect(lower).not.toContain(forbidden);
    }
  });
});
