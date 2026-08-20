import { describe, expect, it } from "vitest";
import { resolveFollowUpQueue } from "@/lib/followup/queue";
import type { FollowUpCandidate } from "@/lib/ghl/store";
import type { Appointment } from "@/lib/ghl/appointments";

/**
 * Resweep High finding: /followup treated any later appointment as a
 * rebooking, including a cancelled one, so a no-show whose replacement
 * booking was then cancelled dropped out of the queue. /today already
 * excluded cancelled appointments, so the two pages disagreed about the same
 * contact. This is now the one implementation both use.
 */

const NOW = Date.UTC(2026, 7, 19, 12, 0, 0);
const MARKED_AT = NOW - 3 * 86_400_000;

function candidate(overrides: Partial<FollowUpCandidate> = {}): FollowUpCandidate {
  return {
    appointmentId: "appt-original",
    contactId: "contact-1",
    contactName: "Casey",
    appointmentTitle: "Discovery",
    markedAt: MARKED_AT,
    status: "noshow",
    timing: "pre-call",
    attempts: 1,
    ...overrides,
  };
}

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "appt-new",
    contactId: "contact-1",
    title: "Rebooked",
    startTime: new Date(NOW - 86_400_000).toISOString(),
    endTime: new Date(NOW - 86_400_000 + 3_600_000).toISOString(),
    status: "confirmed",
    ...overrides,
  } as Appointment;
}

const DAYS_CONFIG = { mode: "days" as const, value: 14 };

describe("resolveFollowUpQueue", () => {
  it("keeps a contact whose only later appointment was cancelled", () => {
    const queue = resolveFollowUpQueue(
      [candidate()],
      [appointment({ status: "cancelled" })],
      DAYS_CONFIG,
      NOW,
    );
    expect(queue).toHaveLength(1);
  });

  it("clears a contact who genuinely rebooked", () => {
    const queue = resolveFollowUpQueue([candidate()], [appointment()], DAYS_CONFIG, NOW);
    expect(queue).toHaveLength(0);
  });

  it("keeps a contact whose later booking predates the outcome", () => {
    // A booking made before the no-show was marked is the appointment they
    // missed, not a replacement for it.
    const queue = resolveFollowUpQueue(
      [candidate()],
      [appointment({ startTime: new Date(MARKED_AT - 86_400_000).toISOString() })],
      DAYS_CONFIG,
      NOW,
    );
    expect(queue).toHaveLength(1);
  });

  it("ages a candidate out past the days threshold", () => {
    const queue = resolveFollowUpQueue(
      [candidate({ markedAt: NOW - 30 * 86_400_000 })],
      [],
      DAYS_CONFIG,
      NOW,
    );
    expect(queue).toHaveLength(0);
  });

  it("drops a candidate past the attempts threshold", () => {
    const queue = resolveFollowUpQueue(
      [candidate({ attempts: 5 })],
      [],
      { mode: "attempts", value: 3 },
      NOW,
    );
    expect(queue).toHaveLength(0);
  });

  it("ignores an appointment with no contact id", () => {
    const queue = resolveFollowUpQueue(
      [candidate()],
      [appointment({ contactId: undefined })],
      DAYS_CONFIG,
      NOW,
    );
    expect(queue).toHaveLength(1);
  });
});
