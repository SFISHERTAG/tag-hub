"use server";

import { revalidatePath } from "next/cache";
import {
  setAppointmentStatus,
  type AppointmentStatus,
} from "@/lib/ghl/appointments";

/**
 * Marks an appointment's outcome.
 *
 * This writes to GHL rather than to a local table on purpose: GHL stays the
 * system of record, and the same status is then visible to anyone working in
 * GHL directly. It is also the signal the Meta conversion dispatch will read
 * once that lands — a showed appointment is the event worth optimising for.
 */
export async function markAppointment(
  locationId: string,
  appointmentId: string,
  status: AppointmentStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await setAppointmentStatus(locationId, appointmentId, status);
    revalidatePath("/today");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
