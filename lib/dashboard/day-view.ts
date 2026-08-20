import "server-only";
import { fetchCalls, type CallForDisplay } from "./data-fetchers";
import { GhlConfigError, LocationNotAuthorizedError } from "@/lib/ghl/tokens";

export type DayViewResult =
  | { ok: true; calls: CallForDisplay[] }
  | { ok: false; message: string };

/**
 * Scoped to the caller's own tenant. `locationId` is resolved from the
 * session by the dashboard page (see lib/dashboard/location-selection.ts)
 * and access-checked there. These fetchers used to read a single global
 * `GHL_LOCATION_ID` env var instead, which meant every client tenant that
 * added this widget saw whichever location that var happened to point at.
 */
export async function getTodayCalls(locationId: string): Promise<DayViewResult> {
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
