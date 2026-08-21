import "server-only";
import type { Session } from "@/lib/auth/session";
import { hasAnyRole, ROLES } from "@/lib/auth/roles";
import {
  getAssignedClients,
  getClientsForCsm,
  getDepartmentClients,
  getTeamClients,
} from "@/lib/dashboard/csm-clients";
import type { ClientData } from "@/lib/dashboard/csm-clients-types";
import type { ApiResult } from "@/lib/api/errorInterceptor";
import { CROSS_BOOK_ROLES } from "./access";
import { badRequest, forbidden, HttpError } from "./http";

/**
 * Which clients a caller is asking for.
 *
 * `mine` is the only scope that needs no argument, because it is derived from
 * the session — it is what legacy/dashboard/page.tsx computed inline from
 * `session.currentRole` and `session.email`. Every other scope is an explicit
 * request for someone else's rows and is gated separately, so widening the
 * view is always a deliberate act by the caller and never a default.
 */
export type ClientBookScope = "mine" | "team" | "department" | "csm";

const SCOPES: readonly ClientBookScope[] = ["mine", "team", "department", "csm"];

export function parseScope(raw: string | null): ClientBookScope {
  if (raw === null || raw === "") return "mine";
  if ((SCOPES as readonly string[]).includes(raw)) return raw as ClientBookScope;
  throw badRequest(`Unknown scope "${raw}". Expected one of: ${SCOPES.join(", ")}.`);
}

function requireSessionEmail(session: Session): string {
  if (!session.email) {
    throw new HttpError(
      409,
      "This account has no email address on its session, so its client book cannot be resolved.",
    );
  }
  return session.email;
}

/**
 * Resolves a client book.
 *
 * The important property: `mine`, `team` and the default `csm` target are all
 * keyed on `session.email`, never on anything the caller sent. A caller-supplied
 * email is only honoured for the explicit `csm` scope, which is the coverage
 * path lib/dashboard/csm-clients.ts documents as deliberately open to any
 * internal CS role. That keeps coverage visible as coverage instead of letting
 * an arbitrary email quietly replace "my book".
 */
export async function loadClientBook(
  session: Session,
  scope: ClientBookScope,
  csmEmail: string | null,
): Promise<ApiResult<ClientData[]>> {
  switch (scope) {
    case "mine":
      return loadOwnBook(session);

    case "team":
      if (!hasAnyRole(session.currentRole, CROSS_BOOK_ROLES)) {
        throw forbidden(`Role "${session.currentRole}" cannot read a team book.`);
      }
      return getTeamClients(requireSessionEmail(session));

    case "department":
      if (!hasAnyRole(session.currentRole, CROSS_BOOK_ROLES)) {
        throw forbidden(`Role "${session.currentRole}" cannot read the department book.`);
      }
      return getDepartmentClients();

    case "csm":
      return getClientsForCsm(csmEmail ?? requireSessionEmail(session));
  }
}

/**
 * The book a role sees by default, ported verbatim from the branching in
 * legacy/dashboard/page.tsx: a CSM sees their assignments, a CSD sees their
 * team, an exec sees the department.
 */
function loadOwnBook(session: Session): Promise<ApiResult<ClientData[]>> {
  if (hasAnyRole(session.currentRole, [ROLES.TAG_CSM])) {
    return getAssignedClients(requireSessionEmail(session));
  }
  if (hasAnyRole(session.currentRole, [ROLES.TAG_CSD])) {
    return getTeamClients(requireSessionEmail(session));
  }
  if (hasAnyRole(session.currentRole, [ROLES.TAG_EXEC, ROLES.ADMIN])) {
    return getDepartmentClients();
  }
  throw forbidden(`Role "${session.currentRole}" has no client book.`);
}
