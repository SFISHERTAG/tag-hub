"use server";

import { getPhase3Status, type Phase3Progress } from "@/lib/dashboard/phase3-status";
import { requireOwnedClient } from "@/lib/auth/session";
import { fail, type ApiResult } from "@/lib/api/errorInterceptor";

/**
 * Server action to fetch Phase 3 status for a client.
 */
export async function getPhase3StatusForClient(clientId: string): Promise<ApiResult<Phase3Progress | null>> {
  try {
    await requireOwnedClient(clientId);
  } catch (error) {
    return fail(`getPhase3StatusForClient(${clientId})`, error);
  }
  return getPhase3Status(clientId);
}
