import "server-only";
import { fetchCalls, type CallForDisplay } from "./data-fetchers";
import { GhlConfigError, LocationNotAuthorizedError } from "@/lib/ghl/tokens";

export type DayViewResult =
  | { ok: true; calls: CallForDisplay[] }
  | { ok: false; message: string };

/**
 * Today's appointments. locationId is the caller's responsibility to
 * resolve and check against the caller's session — see
 * lib/dashboard/location-selection.ts#getLocationForDashboard.
 */
export async function getTodayCalls(locationId: string): Promise<DayViewResult> {
  if (!locationId) {
    return { ok: false, message: "No GHL location configured yet." };
  }

  try {
    const calls = await fetchCalls(locationId, 0);
    return { ok: true, calls };
  } catch (error) {
    if (error instanceof GhlConfigError || error instanceof LocationNotAuthorizedError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
