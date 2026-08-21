import { describe, expect, it, vi } from "vitest";

/**
 * Two resweep High findings on the funnel:
 *
 * - Show rate could render over 100%. The showed/DQ sets are keyed by
 *   contact while outcomes are per appointment, so a contact with both a
 *   showed appointment and a pre-call DQ was subtracted from the denominator
 *   while still counting in the numerator.
 * - The lead fetch took a single 100-contact page and filtered it
 *   client-side, so any window with more contacts than that under-reported
 *   every stage and still returned ok: true.
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

describe("getFunnelCounts show rate", () => {
  it("never counts a contact as both showed and a pre-call DQ", async () => {
    // One contact, two appointments: they showed for one and were marked a
    // pre-call DQ on the other. Before the fix that produced showed=1 over a
    // denominator of 0, i.e. a show rate above 100%.
    listContactsAddedSince.mockResolvedValue({
      contacts: [{ id: "contact-1", dateAdded: recently }],
      truncated: false,
    });
    getAppointments.mockResolvedValue([
      { id: "appt-showed", contactId: "contact-1", status: "showed" },
      { id: "appt-dq", contactId: "contact-1", status: "invalid" },
    ]);
    loadAppointmentOutcomes.mockResolvedValue(
      new Map([["appt-dq", { timing: "pre-call" }]]),
    );

    const result = await getFunnelCounts("loc-1", 30);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const showed = result.stages.find((s) => s.stage === "Showed")!.count;
    expect(showed).toBe(1);
    expect(result.showRateDenominator).toBe(1);
    expect(showed / result.showRateDenominator).toBeLessThanOrEqual(1);
    expect(result.dqBreakdown.preCall).toBe(0);
  });

  it("still drops a genuine pre-call DQ from the denominator", async () => {
    listContactsAddedSince.mockResolvedValue({
      contacts: [
        { id: "showed-contact", dateAdded: recently },
        { id: "dq-contact", dateAdded: recently },
      ],
      truncated: false,
    });
    getAppointments.mockResolvedValue([
      { id: "a1", contactId: "showed-contact", status: "showed" },
      { id: "a2", contactId: "dq-contact", status: "invalid" },
    ]);
    loadAppointmentOutcomes.mockResolvedValue(new Map([["a2", { timing: "pre-call" }]]));

    const result = await getFunnelCounts("loc-1", 30);
    if (!result.ok) throw new Error(result.message);

    expect(result.showRateDenominator).toBe(1);
    expect(result.dqBreakdown.preCall).toBe(1);
  });
});

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
