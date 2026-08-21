import "server-only";
import type { Appointment } from "@/lib/ghl/appointments";
import type { FollowUpCandidate } from "@/lib/ghl/store";

/**
 * Which follow-up candidates are still owed a follow-up.
 *
 * This lived inside app/l/[locationId]/today/page.tsx while /followup carried
 * its own inline version of the same rule, and the two had already drifted:
 * /today excluded cancelled appointments when deciding "has this contact
 * rebooked", /followup did not. So a no-show whose replacement booking was
 * cancelled counted as rebooked and dropped out of the queue, which is
 * exactly the lead a follow-up queue exists to catch.
 *
 * One implementation, one place, so there is nothing left to drift.
 */

/** How far ahead to look when checking whether a contact already has a new booking (story 2.8 AC4). */
export const FOLLOW_UP_LOOKAHEAD_DAYS = 30;

export type FollowUpConfigInput = { mode: "days" | "attempts"; value: number };

/**
 * Latest genuine booking per contact.
 *
 * A cancelled appointment is not a rebooking. It is the opposite: someone
 * booked and then did not keep it, which makes the follow-up more necessary,
 * not less.
 */
function latestBookingByContact(appointments: Appointment[]): Map<string, number> {
  const latest = new Map<string, number>();
  for (const appt of appointments) {
    if (!appt.contactId || appt.status === "cancelled") continue;
    const startsAt = Date.parse(appt.startTime);
    if (Number.isNaN(startsAt)) continue;
    const current = latest.get(appt.contactId) ?? -Infinity;
    if (startsAt > current) latest.set(appt.contactId, startsAt);
  }
  return latest;
}

/**
 * Filters candidates down to ones still owed a follow-up: cleared once a
 * newer appointment is booked (AC4), aged out past the configured threshold
 * (AC2/AC3). Takes `now` so callers keep `Date.now()` out of a render body
 * and tests can pin it.
 */
export function resolveFollowUpQueue(
  candidates: FollowUpCandidate[],
  nearbyAppointments: Appointment[],
  config: FollowUpConfigInput,
  now: number = Date.now(),
): FollowUpCandidate[] {
  const latest = latestBookingByContact(nearbyAppointments);

  return candidates.filter((candidate) => {
    const newestBooking = latest.get(candidate.contactId);
    if (newestBooking !== undefined && newestBooking > candidate.markedAt) return false;

    if (config.mode === "days") {
      const daysSince = (now - candidate.markedAt) / 86_400_000;
      if (daysSince > config.value) return false;
    } else if (candidate.attempts > config.value) {
      return false;
    }

    return true;
  });
}
