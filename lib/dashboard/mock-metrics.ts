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
