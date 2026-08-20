import { describe, expect, it, vi } from "vitest";

/**
 * Story 4.4 AC6 + dev notes: an ad with conversions but zero recorded spend
 * must render "—" (null), never Infinity — a new client with a live campaign
 * and no Meta spend synced yet must not crash or show garbage. An ad with
 * real spend but zero conversions is a genuine 0.00 ROAS, not blanked out.
 */

vi.mock("@/lib/ghl/tenants", () => ({
  getTenant: vi.fn(async (locationId: string) => ({
    locationId,
    name: "Test Tenant",
    services: {},
    ownerModel: "client",
    metaAdAccountId: "act_123",
  })),
}));

vi.mock("@/lib/ghl/pipelines", () => ({
  getPipelines: vi.fn(async () => [{ id: "pipe_1", name: "Sales", stages: [] }]),
}));

const wonOpportunities = [
  // ad_zero_spend: has a conversion but Meta hasn't recorded any spend for it.
  {
    id: "opp_1",
    name: "Deal 1",
    pipelineId: "pipe_1",
    pipelineStageId: "won",
    status: "won",
    monetaryValue: 5000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastStageChangeAt: new Date().toISOString(),
    contact: { id: "contact_1" },
  },
];

vi.mock("@/lib/ghl/opportunities", () => ({
  getOpportunities: vi.fn(async () => wonOpportunities),
}));

vi.mock("@/lib/ghl/contacts", () => ({
  getContact: vi.fn(async (_locationId: string, contactId: string) => {
    if (contactId === "contact_1") {
      return { id: contactId, attributionSource: { utmAdId: "ad_zero_spend" } };
    }
    return null;
  }),
}));

vi.mock("@/lib/meta/ads", () => ({
  getAdSpend: vi.fn(async () => [
    // ad_zero_conversions: real spend, no won deals attributed to it.
    { adId: "ad_zero_conversions", adName: "Static — Free Assessment", spend: 900, spend7d: 200 },
  ]),
}));

const { getAdRoas } = await import("@/lib/dashboard/roas");

describe("getAdRoas safe division", () => {
  it("shows '—' (null) for an ad with conversions but zero spend, not Infinity", async () => {
    const result = await getAdRoas("loc_1", 30);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = result.rows.find((r) => r.adId === "ad_zero_spend");
    expect(row).toBeDefined();
    expect(row!.spend).toBe(0);
    expect(row!.revenue).toBe(5000);
    expect(row!.roas).toBeNull();
    expect(Number.isFinite(row!.roas)).toBe(false);
  });

  it("shows a real 0.00 ROAS for an ad with spend but zero conversions", async () => {
    const result = await getAdRoas("loc_1", 30);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = result.rows.find((r) => r.adId === "ad_zero_conversions");
    expect(row).toBeDefined();
    expect(row!.spend).toBe(900);
    expect(row!.revenue).toBe(0);
    expect(row!.roas).toBe(0);
  });

  it("sorts descending by ROAS with nulls last", async () => {
    const result = await getAdRoas("loc_1", 30);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ids = result.rows.map((r) => r.adId);
    expect(ids.indexOf("ad_zero_conversions")).toBeLessThan(ids.indexOf("ad_zero_spend"));
  });
});
