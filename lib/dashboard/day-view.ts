import "server-only";
import { fetchCalls, type CallForDisplay } from "./data-fetchers";
import { GhlConfigError, LocationNotAuthorizedError, devLocationId } from "@/lib/ghl/tokens";

export type DayViewResult =
  | { ok: true; calls: CallForDisplay[] }
  | { ok: false; message: string };

/** Today's appointments, same single-tenant `devLocationId()` resolution as getPipelineBoardSummary. */
export async function getTodayCalls(): Promise<DayViewResult> {
  const locationId = devLocationId();
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
