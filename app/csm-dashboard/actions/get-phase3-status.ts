"use server";

import { getPhase3Status, type Phase3Progress } from "@/lib/dashboard/phase3-status";
import type { ApiResult } from "@/lib/api/errorInterceptor";

/**
 * Server action to fetch Phase 3 status for a client.
 */
export async function getPhase3StatusForClient(clientId: string): Promise<ApiResult<Phase3Progress | null>> {
  return getPhase3Status(clientId);
}
