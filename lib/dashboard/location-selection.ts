import "server-only";
import { type Session, isInternalRole } from "@/lib/auth/session";
import { ROLES, type Role } from "@/lib/auth/roles";

/**
 * Which GHL location a signed-in user's dashboard reads from.
 *
 * TAG staff work out of the agency's own sub-account (TAG_GROWTH); a client
 * user works out of the tenant on their grant. That is the whole rule, and
 * it has to be answered from the *session* — resolving it from a global
 * `GHL_LOCATION_ID` env var, as the widget fetchers used to, means two
 * different paying tenants open the same dashboard and see the same
 * numbers.
 *
 * The resolution is exhaustive over `ROLES` on purpose. The previous version
 * listed four internal roles and three client roles by hand and fell through
 * to `locations[0]` for the other six — including `tag_csd`, a real
 * documented role — which is a silent misroute rather than a refusal.
 */

export type LocationResolution =
  | { ok: true; locationId: string }
  | { ok: false; message: string };

/** Client-tenant roles: scoped to the one location on their grant. */
const CLIENT_ROLES: readonly Role[] = [
  "client_owner",
  "client_manager",
  "client_closer",
  "client_setter_manager",
  "client_setter",
];

export function resolveDashboardLocation(session: Session): LocationResolution {
  const { currentRole, locations } = session;

  if (isInternalRole(currentRole)) {
    const tagGrowthId = process.env.GHL_LOCATION_ID_TAG_GROWTH?.trim();
    if (!tagGrowthId) {
      return {
        ok: false,
        message: "GHL_LOCATION_ID_TAG_GROWTH is not configured in this environment.",
      };
    }
    return { ok: true, locationId: tagGrowthId };
  }

  if (CLIENT_ROLES.includes(currentRole)) {
    const locationId = locations[0];
    if (!locationId) {
      return { ok: false, message: "This login has no client account assigned to it." };
    }
    return { ok: true, locationId };
  }

  // Unreachable while CLIENT_ROLES ∪ internal roles covers ROLES — kept as a
  // refusal rather than a fallback so a role added to role-labels.ts without
  // being classified here fails loudly instead of reading someone's data.
  return {
    ok: false,
    message: `Role "${currentRole}" has no dashboard location mapping.`,
  };
}

/** Throwing form, for callers that treat an unresolvable location as fatal. */
export function getLocationForDashboard(session: Session): string {
  const resolved = resolveDashboardLocation(session);
  if (!resolved.ok) throw new Error(resolved.message);
  return resolved.locationId;
}

/** Type-safe way to check if user is a CSM/internal user. */
export function isInternalUser(role: Role): boolean {
  return isInternalRole(role);
}

/** Type-safe way to check if user is a client. */
export function isClientUser(role: Role): boolean {
  return CLIENT_ROLES.includes(role);
}

/**
 * Compile-time guard that every role in the registry is classified. If a new
 * role lands in role-labels.ts without being added to `CLIENT_ROLES` or to
 * `INTERNAL_ROLES` in lib/auth/session.ts, this stops being exhaustive and
 * the assertion below fails the build.
 */
const UNCLASSIFIED = ROLES.filter(
  (role) => !isInternalRole(role) && !CLIENT_ROLES.includes(role),
);
if (UNCLASSIFIED.length > 0) {
  throw new Error(
    `Roles with no dashboard location mapping: ${UNCLASSIFIED.join(", ")}. ` +
      "Classify them in lib/dashboard/location-selection.ts.",
  );
}
