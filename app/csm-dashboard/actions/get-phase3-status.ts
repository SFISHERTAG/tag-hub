"use server";

import { getPhase3Status, type Phase3Progress } from "@/lib/dashboard/phase3-status";

/**
 * Server action to fetch Phase 3 status for a client.
 */
export async function getPhase3StatusForClient(clientId: string): Promise<Phase3Progress | null> {
  try {
    const status = await getPhase3Status(clientId);
    return status;
  } catch (error) {
    console.error("Error in getPhase3StatusForClient:", error);
    throw new Error("Failed to fetch Phase 3 status");
  }
}
