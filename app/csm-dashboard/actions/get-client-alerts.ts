"use server";

import { getClientAlerts, type ClientAlert } from "@/lib/dashboard/csm-clients";

/**
 * Server action to fetch alerts for a client.
 * See get-assigned-clients.ts for why this indirection exists.
 */
export async function getClientAlertsForClient(clientId: string): Promise<ClientAlert[]> {
  return getClientAlerts(clientId);
}
