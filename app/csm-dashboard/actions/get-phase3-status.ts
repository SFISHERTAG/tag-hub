"use server";

import { requireSession, requireLocationAccess } from "@/lib/auth/session";
import { getPhase3Status, type Phase3Progress } from "@/lib/dashboard/phase3-status";
import { getClientLocationId } from "@/lib/dashboard/csm-clients";

/**
 * Server action to fetch Phase 3 status for a client.
 */
export async function getPhase3StatusForClient(clientId: string): Promise<Phase3Progress | null> {
  await requireSession();

  const locationId = await getClientLocationId(clientId);
  if (!locationId) {
    throw new Error(`Client ${clientId} not found`);
  }
  await requireLocationAccess(locationId);

  try {
    // getPhase3Status queries Postgres by location_id, not the Firestore
    // clientId. Pass the resolved locationId rather than the raw clientId
    // this previously received (and only coincidentally correctly, since
    // seed data sets them equal).
    const status = await getPhase3Status(locationId);
    return status;
  } catch (error) {
    console.error("Error in getPhase3StatusForClient:", error);
    throw new Error("Failed to fetch Phase 3 status");
  }
}
