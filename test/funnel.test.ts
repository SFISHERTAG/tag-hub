import { describe, expect, it, vi } from "vitest";

/**
 * The lead fetch took a single 100-contact page and filtered it client-side,
 * so any window with more contacts than that under-reported every stage and
 * still returned ok: true. A capped fetch now says so.
 *
 * The show-rate-over-100% finding from the same source commit is a separate
 * fix and is deliberately not ported here.
 */

const listContactsAddedSince = vi.fn();
const getAppointments = vi.fn();
const loadAppointmentOutcomes = vi.fn();

vi.mock("@/lib/ghl/contacts", () => ({
  listContactsAddedSince: (...args: unknown[]) => listContactsAddedSince(...args),
}));

vi.mock("@/lib/ghl/appointments", () => ({
  getAppointments: (...args: unknown[]) => getAppointments(...args),
}));

vi.mock("@/lib/ghl/pipelines", () => ({
  getPipelines: async () => [],
}));

vi.mock("@/lib/ghl/opportunities", () => ({
  getOpportunities: async () => [],
}));

vi.mock("@/lib/ghl/store", () => ({
  loadAppointmentOutcomes: (...args: unknown[]) => loadAppointmentOutcomes(...args),
}));

const { getFunnelCounts } = await import("@/lib/dashboard/funnel");

const NOW = Date.now();
const recently = new Date(NOW - 60 * 60 * 1000).toISOString();

describe("getFunnelCounts truncation", () => {
  it("reports an incomplete contact fetch instead of passing it off as a full count", async () => {
    listContactsAddedSince.mockResolvedValue({
      contacts: [{ id: "contact-1", dateAdded: recently }],
      truncated: true,
    });
    getAppointments.mockResolvedValue([]);
    loadAppointmentOutcomes.mockResolvedValue(new Map());

    const result = await getFunnelCounts("loc-1", 30);
    if (!result.ok) throw new Error(result.message);

    expect(result.truncated).toBe(true);
  });

  it("reports a complete fetch as complete", async () => {
    listContactsAddedSince.mockResolvedValue({
      contacts: [{ id: "contact-1", dateAdded: recently }],
      truncated: false,
    });
    getAppointments.mockResolvedValue([]);
    loadAppointmentOutcomes.mockResolvedValue(new Map());

    const result = await getFunnelCounts("loc-1", 30);
    if (!result.ok) throw new Error(result.message);

    expect(result.truncated).toBe(false);
  });
});
