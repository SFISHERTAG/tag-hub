import "server-only";
import type { Session } from "@/lib/auth/session";
import { ROLES, type Role } from "@/lib/auth/roles";
import { isInternalRole } from "@/lib/auth/session";

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

/**
 * Which location this session's dashboard reads, or a typed fault.
 *
 * Routing is on `isInternalRole`, not on the two lists above, and that
 * difference is the defect this closes. `isInternalUser` names four TAG-side
 * roles and `isClientUser` three client ones, so six of the thirteen in `ROLES`
 * matched neither: `admin`, `tag_csd`, `tag_setter_manager`, `tag_setter`,
 * `client_setter_manager`, `client_setter`. Those six fell to a third exit that
 * RETURNED rather than threw, `locations[0] || process.env.GHL_LOCATION_ID || ""`,
 * so an unset agency location reached them as the legacy single tenant or as the
 * empty string, and story 8.7's alert never fired for them at all.
 *
 * `isInternalRole` (lib/auth/session.ts) is the exhaustive partition: eight
 * TAG-side roles, with the five `client_*` roles as the complement.
 * test/internal-role.test.ts already asserts no role is left unclassified, so a
 * role added to `ROLES` later cannot silently reopen this hole.
 *
 * The two lists above are deliberately NOT widened to close it. `isClientUser`
 * names three of the five client roles on purpose; lib/auth/session.ts and
 * test/internal-role.test.ts both depend on that narrowness, and adding the two
 * setter roles would flip a client setter's onboarding surface to read-only,
 * which is a permission change in an unrelated feature.
 *
 * Dropping the `GHL_LOCATION_ID` fallback is stories 1.3 and 1.5 taking effect
 * here at last: that variable names the PIT's own sub-account (lib/ghl/tokens.ts)
 * and was never meant to decide what a signed-in user sees.
 */
export function getLocationForDashboard(session: Session): string {
  const { currentRole, locations } = session;

  if (isInternalRole(currentRole)) {
    const tagGrowthId = process.env.GHL_LOCATION_ID_TAG_GROWTH;
    if (!tagGrowthId) {
      throw new DashboardLocationError(
        "config",
        "GHL_LOCATION_ID_TAG_GROWTH not configured in environment",
      );
    }
    return tagGrowthId;
  }

  if (!locations[0]) {
    throw new DashboardLocationError("unassigned", "Client has no assigned location");
  }
  return locations[0];
}

/**
 * Whether this role gets the agency dashboard surface.
 *
 * NOT a general "is this person internal" test, and no longer used for location
 * routing: it names four of the eight TAG-side roles. Use `isInternalRole`
 * (lib/auth/session.ts) for anything that must cover the whole taxonomy.
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
