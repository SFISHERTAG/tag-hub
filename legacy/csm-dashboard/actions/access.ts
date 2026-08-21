import "server-only";
import { requireRole } from "@/lib/auth/session";
import type { Role } from "@/lib/auth/roles";

/**
 * Every action in this directory is a directly-callable server action, not
 * just a function reached through csm-portfolio.tsx's component tree — this
 * is the actual guard. The role list intentionally allows any internal CS
 * role to view any client or any CSM's book (see getClientsForCsm's "jump in
 * and help" coverage design in lib/dashboard/csm-clients.ts); the boundary
 * being enforced here is staff vs. client-facing roles, not per-CSM
 * ownership, which this codebase deliberately does not lock down further.
 */
const CSM_DASHBOARD_ROLES: readonly Role[] = ["tag_csm", "tag_csd", "tag_exec", "admin"];

export function requireCsmAccess() {
  return requireRole(CSM_DASHBOARD_ROLES);
}
