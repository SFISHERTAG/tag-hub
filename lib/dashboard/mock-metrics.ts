/**
 * Placeholder metrics for the client-owner dashboard.
 *
 * Every field name here matches docs/client-fields.md exactly — spend.*,
 * funnel.*, econ.* — and every one of these is marked NOW: ○ there, meaning
 * blocked on Story 4.1 (Meta Business Manager setup), not built yet. This
 * module exists so the dashboard can ship in the real shape today and become
 * a data-fetching change, not a redesign, once 4.1 lands.
 *
 * Nothing here is randomised — fixed numbers so a screenshot today matches a
 * screenshot tomorrow, which matters for reviewing the design itself.
 */

import type { HealthMetrics } from "./health-scoring";

export type ChannelSpend = { channel: string; amount: number };

export type AdPerformance = {
  ad: string;
  spend: number;
  leads: number;
};

export type FunnelStage = {
  stage: "Leads" | "Booked" | "Showed" | "Closed";
  count: number;
};

export type MockMetrics = {
  /** All client_owner-visible (●) per client-fields.md §5, §7, §9. */
  kpis: {
    spendActual: number;
    spendBudget: number;
    roas: number;
    cpl: number;
    bookingRatePct: number;
    costPerBooked: number;
  };
  spendByChannel: ChannelSpend[];
  spendByAd: AdPerformance[];
  funnel: FunnelStage[];
  topDeals: { name: string; value: number; stage: string }[];
};

/**
 * Sample input for calculateHealthScore (health-scoring.ts) — a different
 * shape for a different consumer than MockMetrics above. MockMetrics is raw
 * KPIs for the client-owner dashboard; this is the four target-achievement
 * percentages the CSM/CSD/exec health score is computed from.
 *
 * Real wiring needs per-client spend and lead targets that don't exist in
 * the schema yet (clients has ghl_location_id and meta_ad_account_id, no
 * budget/lead-target columns) — inventing a number here would let an
 * unconfirmed threshold quietly drive real escalations. Same call this
 * codebase already made in sample-data-banner.tsx: real-shaped numbers, not
 * blanks, until the real integration lands as one unit.
 *
 * Note that the `clientId` argument is ignored: every client gets the same
 * four numbers, so the health score, the status badge and the escalation
 * bucket derived from them are identical for the whole book. Any surface
 * that renders them must carry `HEALTH_SAMPLE_DATA_NOTICE` via
 * <SampleDataBanner />, and `ClientHealth.is_sample` marks the values
 * themselves so a consumer can tell without knowing where they came from.
 */
export function getMockMetrics(_clientId: string): HealthMetrics {
  return { roas: 95, spend: 102, leads: 88, sla: 97 };
}

/** The disclosure that has to accompany anything derived from getMockMetrics. */
export const HEALTH_SAMPLE_DATA_NOTICE =
  "client health scores, statuses and escalation buckets below are computed from placeholder " +
  "metrics that are the same for every client. Do not escalate, or hold off on escalating, " +
  "based on these. Live scoring needs per-client spend and lead targets, which the schema " +
  "does not carry yet.";

export const MOCK_METRICS: MockMetrics = {
  kpis: {
    spendActual: 8420,
    spendBudget: 10000,
    roas: 4.2,
    cpl: 38,
    bookingRatePct: 34,
    costPerBooked: 112,
  },
  spendByChannel: [
    { channel: "Meta", amount: 5680 },
    { channel: "Google", amount: 2740 },
  ],
  spendByAd: [
    { ad: "VSL — Advisory Growth", spend: 2860, leads: 61 },
    { ad: "Static — Tax Season Hook", spend: 1920, leads: 34 },
    { ad: "VSL — Client Testimonial", spend: 1640, leads: 29 },
    { ad: "Carousel — Case Study", spend: 1240, leads: 18 },
    { ad: "Static — Free Assessment", spend: 760, leads: 15 },
  ],
  funnel: [
    { stage: "Leads", count: 157 },
    { stage: "Booked", count: 53 },
    { stage: "Showed", count: 41 },
    { stage: "Closed", count: 9 },
  ],
  topDeals: [
    { name: "Lakemore Advisory Group", value: 24500, stage: "Closed" },
    { name: "Bricktown Tax Partners", value: 18900, stage: "Closed" },
    { name: "Summit Ridge CPAs", value: 15200, stage: "Booked" },
    { name: "Harlow & Vance", value: 12800, stage: "Showed" },
    { name: "Northline Advisory", value: 9600, stage: "Booked" },
  ],
};
