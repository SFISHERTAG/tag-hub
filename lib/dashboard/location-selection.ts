import "server-only";
import type { Session } from "@/lib/auth/session";
import { ROLES, type Role } from "@/lib/auth/roles";

/**
 * The two role sets this module routes on, named once.
 *
 * Each list was written out twice — once inline in getLocationForDashboard and
 * again in the isInternalUser / isClientUser helper below it — which is two
 * places to forget when a role is added. Story 14.B consolidated them while
 * converting the literals to ROLES.*, the same shape 15.A used for
 * GLOBAL_ROLES.
 */
const AGENCY_DASHBOARD_ROLES: readonly Role[] = [
  ROLES.TAG_EXEC,
  ROLES.TAG_CSM,
  ROLES.TAG_SALES,
  ROLES.TAG_SALES_MANAGER,
];

const CLIENT_DASHBOARD_ROLES: readonly Role[] = [
  ROLES.CLIENT_OWNER,
  ROLES.CLIENT_MANAGER,
  ROLES.CLIENT_CLOSER,
];

/**
 * Determine which location ID to use based on user role and session.
 *
 * - CSM/Exec users: Use TAG_GROWTH (Tax Advisory Growth agency sub-account)
 * - Client users: Use their assigned sub-account from session.locations[0]
 */

/**
 * Why this failure is typed rather than a bare Error.
 *
 * Both branches below throw, and until 2026-08-25 the only caller caught both
 * with `catch { return null }` and substituted sample data. That collapsed two
 * conditions that deserve opposite responses:
 *
 *   "config"     -- GHL_LOCATION_ID_TAG_GROWTH is unset. A deploy fault. Every
 *                   internal user's live funnel silently becomes a fixture, and
 *                   nobody operating the system is told.
 *   "unassigned" -- a client role holds no location. A data state, not a deploy
 *                   fault, and sample data is a defensible answer to it.
 *
 * Matching on the message string would work and would break the first time
 * someone rewords it, so the discriminant is a field.
 */
export type LocationFaultKind = "config" | "unassigned";

export class DashboardLocationError extends Error {
  readonly kind: LocationFaultKind;

  constructor(kind: LocationFaultKind, message: string) {
    super(message);
    this.name = "DashboardLocationError";
    this.kind = kind;
  }
}

export function getLocationForDashboard(session: Session): string {
  const { currentRole, locations } = session;

  // CSM/Exec roles: use TAG_GROWTH agency sub-account
  if (isInternalUser(currentRole)) {
    const tagGrowthId = process.env.GHL_LOCATION_ID_TAG_GROWTH;
    if (!tagGrowthId) {
      throw new DashboardLocationError(
        "config",
        "GHL_LOCATION_ID_TAG_GROWTH not configured in environment",
      );
    }
    return tagGrowthId;
  }

  // Client roles: use their assigned location
  if (isClientUser(currentRole)) {
    if (!locations[0]) {
      throw new DashboardLocationError("unassigned", "Client has no assigned location");
    }
    return locations[0];
  }

  // Fallback
  return locations[0] || process.env.GHL_LOCATION_ID || "";
}

/**
 * Type-safe way to check if user is a CSM/internal user.
 */
export function isInternalUser(role: Role): boolean {
  return AGENCY_DASHBOARD_ROLES.includes(role);
}

/**
 * Type-safe way to check if user is a client.
 */
export function isClientUser(role: Role): boolean {
  return CLIENT_DASHBOARD_ROLES.includes(role);
}
