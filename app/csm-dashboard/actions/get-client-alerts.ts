"use server";

import { requireSession, requireLocationAccess } from "@/lib/auth/session";
import { getClientAlerts, getClientLocationId, type ClientAlert } from "@/lib/dashboard/csm-clients";

/**
 * Server action to fetch alerts for a client.
 * See get-assigned-clients.ts for why this indirection exists.
 */
export async function getClientAlertsForClient(clientId: string): Promise<ClientAlert[]> {
  await requireSession();

  const locationId = await getClientLocationId(clientId);
  if (!locationId) {
    throw new Error(`Client ${clientId} not found`);
  }
  await requireLocationAccess(locationId);

  return getClientAlerts(clientId);
}
