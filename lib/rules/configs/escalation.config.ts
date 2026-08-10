import type { RulesConfig } from "@/lib/rules/types";

/**
 * Story 3.6 escalation view — Ascension Ready / At Risk / No Action Needed.
 *
 * Defined now so the engine has a second, structurally unrelated config to
 * prove genericity against (see engine.test.ts) and so 3.6 is a UI + data
 * task, not a rules-design task, when it's picked up.
 *
 * NOT WIRED YET. `showRatePct` is computed today (lib/ghl/portfolio.ts).
 * `deliveryStalled`, `daysSinceLastCheckIn`, and `upsellAttempted` are not —
 * they need, respectively: a stage-age signal off the fulfillment pipeline
 * (see the TODO on getFulfillmentStage), the audit log from story 3.5, and an
 * upsell-attempt marker that doesn't exist anywhere yet. Evaluating this
 * config with those fields absent is safe — evaluateRules() treats a missing
 * field as "condition not met" and falls through, so today it would just
 * never produce "ascension-ready" or the delivery/check-in "at-risk"
 * branches. It will not throw or misclassify.
 */
export const escalationRules: RulesConfig = {
  id: "escalation-v1",
  label: "Portfolio escalation view (ascension and risk)",
  rules: [
    {
      id: "at-risk-show-rate",
      label: "Show rate collapsed (< 15%)",
      bucket: "at-risk",
      when: [{ field: "showRatePct", operator: "lt", value: 15 }],
    },
    {
      id: "at-risk-delivery-stalled",
      label: "Delivery stalling",
      bucket: "at-risk",
      when: [{ field: "deliveryStalled", operator: "eq", value: true }],
    },
    {
      id: "at-risk-no-checkin",
      label: "No CSM check-in for 30+ days",
      bucket: "at-risk",
      when: [{ field: "daysSinceLastCheckIn", operator: "gte", value: 30 }],
    },
    {
      id: "ascension-ready",
      label: "Healthy, no upsell attempted yet",
      bucket: "ascension-ready",
      when: [
        { field: "showRatePct", operator: "gte", value: 30 },
        { field: "upsellAttempted", operator: "eq", value: false },
      ],
    },
  ],
  defaultBucket: "no-action-needed",
};
