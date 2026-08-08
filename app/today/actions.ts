"use server";

import { revalidatePath } from "next/cache";
import {
  setAppointmentStatus,
  type AppointmentStatus,
} from "@/lib/ghl/appointments";
import { classifyTiming, saveAppointmentOutcome } from "@/lib/ghl/store";

/**
 * Marks an appointment's outcome.
 *
 * The status goes to GHL, which stays the system of record and keeps the value
 * visible to anyone working there directly. Alongside it we record *when* the
 * mark happened relative to the appointment, because GHL does not — and that
 * timing is what separates a pre-call DQ (bad targeting, no call happened)
 * from an on-call DQ (real person, wrong fit). Those belong on opposite sides
 * of a show-rate calculation.
 *
 * The GHL write is what must succeed. Losing the timing record degrades a
 * metric; failing the status write loses the closer's work.
 */
export async function markAppointment(
  locationId: string,
  appointmentId: string,
  status: AppointmentStatus,
  appointment: { startTime: string; endTime: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await setAppointmentStatus(locationId, appointmentId, status);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  try {
    const markedAt = Date.now();
    const startsAt = Date.parse(appointment.startTime);
    const endsAt = Date.parse(appointment.endTime);

    if (!Number.isNaN(startsAt) && !Number.isNaN(endsAt)) {
      await saveAppointmentOutcome(locationId, appointmentId, {
        status,
        timing: classifyTiming(markedAt, startsAt, endsAt),
        markedAt,
        appointmentStartsAt: startsAt,
        appointmentEndsAt: endsAt,
      });
    }
  } catch {
    // Timing is analytics context, not the closer's work. If Firestore is
    // unreachable the status is already saved in GHL, which is what matters.
  }

  revalidatePath("/today");
  return { ok: true };
}
