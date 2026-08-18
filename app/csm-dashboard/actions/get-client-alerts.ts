"use server";

import { getClientAlerts, type ClientAlert } from "@/lib/dashboard/csm-clients";
import type { ApiResult } from "@/lib/api/errorInterceptor";

/**
 * Server action to fetch alerts for a client.
 * See get-assigned-clients.ts for why this indirection exists.
 */
export async function getClientAlertsForClient(clientId: string): Promise<ApiResult<ClientAlert[]>> {
  return getClientAlerts(clientId);
}
