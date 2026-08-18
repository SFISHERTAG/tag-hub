import type { RulesConfig } from "@/lib/rules/types";

/**
 * Story 3.6 escalation view — Ascension Ready / At Risk / No Action Needed.
 *
 * Defined now so the engine has a second, structurally unrelated config to
 * prove genericity against (see engine.test.ts) and so 3.6 is a UI + data
 * task, not a rules-design task, when it's picked up.
 *
 * `daysSinceLastCheckIn`, `criticalHealth`, and `healthy` ARE wired
 * (lib/dashboard/csm-clients.ts's computeEscalation): the first reads story
 * 3.5's audit log (createImpersonationEntry, called from 3.3's
 * enterImpersonation), the other two derive from the health score already
 * computed for every client.
 *
 * `showRatePct` and `deliveryStalled` are NOT wired — they need a live
 * per-client GHL fetch (calendar events for the former, a resolved
 * fulfillment-pipeline id for the latter) added to what's today a
 * pure-Firestore read path. Evaluating this config with those fields absent
 * is safe — evaluateRules() treats a missing field as "condition not met"
 * and falls through, so today it would just never produce the show-rate/
 * delivery branches of "at-risk". It will not throw or misclassify.
 */
export const escalationRules: RulesConfig = {
  id: "escalation-v1",
  label: "Portfolio escalation view (ascension and risk)",
  rules: [
    {
      id: "at-risk-critical-health",
      label: "Critical health",
      bucket: "at-risk",
      when: [{ field: "criticalHealth", operator: "eq", value: true }],
    },
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
        { field: "healthy", operator: "eq", value: true },
        { field: "upsellAttempted", operator: "eq", value: false },
      ],
    },
  ],
  defaultBucket: "no-action-needed",
};
