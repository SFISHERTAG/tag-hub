"use server";

import { getClientAlerts, type ClientAlert } from "@/lib/dashboard/csm-clients";
import { requireCsmAccess } from "./access";
import { fail, type ApiResult } from "@/lib/api/errorInterceptor";

/**
 * Server action to fetch alerts for a client.
 * See get-assigned-clients.ts for why this indirection exists.
 */
export async function getClientAlertsForClient(clientId: string): Promise<ApiResult<ClientAlert[]>> {
  try {
    await requireCsmAccess();
  } catch (error) {
    return fail(`getClientAlertsForClient(${clientId})`, error);
  }
  return getClientAlerts(clientId);
}
