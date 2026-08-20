"use server";

import { getAssignedClients, type ClientData } from "@/lib/dashboard/csm-clients";
import { requireInternalRole } from "@/lib/auth/session";
import { fail, type ApiResult } from "@/lib/api/errorInterceptor";

/**
 * Server action to fetch clients assigned to a CSM.
 *
 * csm-clients.ts calls the Firestore Admin SDK, which drags in
 * grpc/fs/net/child_process — code that must never reach the client bundle.
 * csm-portfolio.tsx is a client component, so it calls through here instead
 * of importing csm-clients.ts directly.
 */
export async function getAssignedClientsForCSM(csmEmail: string): Promise<ApiResult<ClientData[]>> {
  // Any CSM may pull up a peer's book — that is the coverage model, not a
  // gap (see getClientsForCsm). What was missing is that *nobody* was
  // checked: an unauthenticated caller, or a client-tenant user, could read
  // any CSM's whole book of health scores and spend by passing an email.
  try {
    await requireInternalRole();
  } catch (error) {
    return fail(`getAssignedClientsForCSM(${csmEmail})`, error);
  }
  return getAssignedClients(csmEmail);
}
