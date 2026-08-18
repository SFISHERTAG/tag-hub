import { describe, it, expect, vi } from "vitest";
import type { AppointmentOutcome } from "@/lib/ghl/store";

/**
 * Story 6.4: a pre-call DQ is a targeting failure (nobody showed) and must
 * drop out of the show-rate denominator entirely, not count as a no-show
 * against it. An on-call DQ (real person, wrong fit) stays in the
 * denominator but never counts as "showed" itself.
 */

const outcomeStore = new Map<string, AppointmentOutcome>();

vi.mock("@/lib/ghl/store", () => ({
  loadAppointmentOutcomes: vi.fn(async (_locationId: string, appointmentIds: string[]) => {
    const found = new Map<string, AppointmentOutcome>();
    for (const id of appointmentIds) {
      const outcome = outcomeStore.get(id);
      if (outcome) found.set(id, outcome);
    }
    return found;
  }),
}));

const { getClientHealth } = await import("@/lib/ghl/portfolio");

function outcome(status: string, timing: AppointmentOutcome["timing"]): AppointmentOutcome {
  return { status, timing, markedAt: 0, appointmentStartsAt: 0, appointmentEndsAt: 0 };
}

describe("getClientHealth show-rate math (story 6.4)", () => {
  it("drops a pre-call DQ from the denominator instead of counting it as a no-show", async () => {
    outcomeStore.clear();
    // 4 booked: 2 showed, 1 pre-call DQ, 1 plain no-show.
    outcomeStore.set("a1", outcome("showed", "on-call"));
    outcomeStore.set("a2", outcome("showed", "on-call"));
    outcomeStore.set("a3", outcome("invalid", "pre-call"));
    outcomeStore.set("a4", outcome("noshow", "post-call"));

    const health = await getClientHealth("loc_1", ["a1", "a2", "a3", "a4"]);

    // Naive (collapsed) math would be 2/4 = 50%. Correct math drops the
    // pre-call DQ from the denominator: 2/(4-1) = 67%.
    expect(health.showRate).toBe(67);
    expect(health.dqBreakdown).toEqual({ preCall: 1, onCall: 0 });
  });

  it("keeps an on-call DQ in the denominator without counting it as showed", async () => {
    outcomeStore.clear();
    outcomeStore.set("a1", outcome("showed", "on-call"));
    outcomeStore.set("a2", outcome("invalid", "on-call"));

    const health = await getClientHealth("loc_1", ["a1", "a2"]);

    // Denominator stays 2 (on-call DQ isn't dropped); numerator stays 1
    // (on-call DQ isn't "showed").
    expect(health.showRate).toBe(50);
    expect(health.dqBreakdown).toEqual({ preCall: 0, onCall: 1 });
  });

  it("defaults an appointment with no outcome record to the denominator, conservatively", async () => {
    outcomeStore.clear();
    outcomeStore.set("a1", outcome("showed", "on-call"));
    // a2 has no outcome record at all — timing unknown.

    const health = await getClientHealth("loc_1", ["a1", "a2"]);

    // Unknown timing must not be treated as a pre-call DQ (which would
    // inflate the rate by shrinking the denominator) — it stays booked.
    expect(health.showRate).toBe(50);
    expect(health.dqBreakdown).toEqual({ preCall: 0, onCall: 0 });
  });
});
