import type { RulesConfig } from "@/lib/rules/types";

/**
 * Story 3.2 client health, MVP thresholds.
 *
 * Config-only — swapping these numbers, or adding delivery-stall / DQ-rate /
 * close-rate rules once that data is computed (story 3.2 names all four as
 * signals; only show rate is wired today), never touches lib/rules/engine.ts.
 * This closes the "TODO: make thresholds dynamically configurable from CSM
 * dashboard" note that was previously hardcoded in lib/ghl/portfolio.ts.
 *
 * Order is most-severe-first: critical is checked before at-risk so a client
 * matching both stops at critical.
 */
export const clientHealthRules: RulesConfig = {
  id: "client-health-v1",
  label: "Client health (show rate)",
  rules: [
    {
      id: "critical-show-rate",
      label: "Show rate below 15%",
      bucket: "critical",
      when: [{ field: "showRatePct", operator: "lt", value: 15 }],
    },
    {
      id: "at-risk-show-rate",
      label: "Show rate 15-30%",
      bucket: "at-risk",
      when: [{ field: "showRatePct", operator: "lt", value: 30 }],
    },
    // Story 3.2 also names delivery stalls, DQ rate, and close rate as health
    // signals. Add them as additional rules targeting "at-risk" / "critical"
    // once that data exists (getFulfillmentStage has a TODO for stage-age;
    // DQ/close rate need the outcome breakdown that getClientHealth already
    // computes but doesn't fully use yet) — no engine change required, only
    // new rules here.
  ],
  defaultBucket: "healthy",
};
