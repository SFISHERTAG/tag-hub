"use server";

import { requireSession } from "@/lib/auth/session";
import { ROLES, type Role } from "@/lib/auth/roles";
import { getAssignedClients, type ClientData } from "@/lib/dashboard/csm-clients";

/**
 * Roles with cross-visibility into every CSM's book, for the three-tier CS
 * rollup's "jump in and help" coverage path. Derived from the canonical
 * ROLES list (lib/auth/roles.ts) rather than a standalone array so a typo'd
 * or renamed role here fails to compile instead of silently never matching.
 */
const CROSS_VISIBILITY_ROLES: readonly Role[] = ROLES.filter(
  (role) => role === "tag_csd" || role === "tag_exec" || role === "admin",
);

/**
 * Server action to fetch clients assigned to a CSM.
 *
 * csm-clients.ts calls the Firestore Admin SDK, which drags in
 * grpc/fs/net/child_process — code that must never reach the client bundle.
 * csm-portfolio.tsx is a client component, so it calls through here instead
 * of importing csm-clients.ts directly.
 *
 * A CSM may only pull their own book; CROSS_VISIBILITY_ROLES get the
 * cross-visibility the three-tier CS rollup relies on for coverage, so they
 * may pull any CSM's book by email.
 */
export async function getAssignedClientsForCSM(csmEmail: string): Promise<ClientData[]> {
  const session = await requireSession();

  const hasCrossVisibility = CROSS_VISIBILITY_ROLES.includes(session.currentRole);

  if (session.email !== csmEmail && !hasCrossVisibility) {
    throw new Error("403 Forbidden: cannot view another CSM's book");
  }

  return getAssignedClients(csmEmail);
}
