import "server-only";
import { repository } from "@/lib/data";

/**
 * Meta's API responses carry no timestamp of their own, so anything that
 * calls the Marketing API on a location's behalf must record when that
 * happened. Story 4.2's getAdSpend and Story 4.4's getAdRoas call
 * recordMetaFetch once they exist; getLastMetaFetch is what Story 4.5's
 * freshness indicator reads.
 */

export async function recordMetaFetch(
  locationId: string,
  fetchedAt: number = Date.now(),
): Promise<void> {
  await repository().metaFetchLog(locationId).set({ fetchedAt });
}

export async function getLastMetaFetch(
  locationId: string,
): Promise<number | null> {
  const log = await repository().metaFetchLog(locationId).get();
  return log?.fetchedAt ?? null;
}
