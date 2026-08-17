"use server";

import { getAssignedClients, type ClientData } from "@/lib/dashboard/csm-clients";

/**
 * Server action to fetch clients assigned to a CSM.
 *
 * csm-clients.ts calls the Firestore Admin SDK, which drags in
 * grpc/fs/net/child_process — code that must never reach the client bundle.
 * csm-portfolio.tsx is a client component, so it calls through here instead
 * of importing csm-clients.ts directly.
 */
export async function getAssignedClientsForCSM(csmEmail: string): Promise<ClientData[]> {
  return getAssignedClients(csmEmail);
}
