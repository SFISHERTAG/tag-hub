import "server-only";
import { firestore } from "@/lib/firestore";

/**
 * Meta's API responses carry no timestamp of their own, so anything that
 * calls the Marketing API on a location's behalf must record when that
 * happened. Story 4.2's getAdSpend and Story 4.4's getAdRoas call
 * recordMetaFetch once they exist; getLastMetaFetch is what Story 4.5's
 * freshness indicator reads.
 */

const fetchLogDoc = (locationId: string) =>
  `locations/${locationId}/metaFetchLog/latest`;

export async function recordMetaFetch(
  locationId: string,
  fetchedAt: number = Date.now(),
): Promise<void> {
  await firestore().doc(fetchLogDoc(locationId)).set({ fetchedAt });
}

export async function getLastMetaFetch(
  locationId: string,
): Promise<number | null> {
  const snapshot = await firestore().doc(fetchLogDoc(locationId)).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() as { fetchedAt?: number };
  return data.fetchedAt ?? null;
}
