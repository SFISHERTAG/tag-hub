"use server";

import { revalidatePath } from "next/cache";
import { requireLocationAccess } from "@/lib/auth/session";

/**
 * Backs the freshness indicator's refresh button. GHL contacts and
 * appointment outcomes are already live queries on every request, so the
 * real work here is invalidating the cached page — a client-side re-render
 * alone would not re-run the server-side data fetches at all.
 */
export async function refreshFreshness(
  locationId: string,
  /** Route to invalidate instead of this location's layout. See the indicator. */
  pathOverride?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireLocationAccess(locationId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  // Only a fixed set of paths, never the caller's string as given: this is a
  // server action, so an arbitrary path argument would let any signed-in
  // caller invalidate any route's cache.
  if (pathOverride === "/dashboard") {
    revalidatePath("/dashboard");
  } else {
    revalidatePath(`/l/${locationId}`, "layout");
  }
  return { ok: true };
}
