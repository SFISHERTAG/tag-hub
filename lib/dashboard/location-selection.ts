import "server-only";
import type { Session } from "@/lib/auth/session";
import type { Role } from "@/lib/auth/roles";

/**
 * Determine which location ID to use based on user role and session.
 *
 * - CSM/Exec users: Use TAG_GROWTH (Tax Advisory Growth agency sub-account)
 * - Client users: Use their assigned sub-account from session.locations[0]
 */

export function getLocationForDashboard(session: Session): string {
  const { currentRole, locations } = session;

  // CSM/Exec roles: use TAG_GROWTH agency sub-account
  if (["tag_exec", "tag_csm", "tag_sales", "tag_sales_manager"].includes(currentRole)) {
    const tagGrowthId = process.env.GHL_LOCATION_ID_TAG_GROWTH;
    if (!tagGrowthId) {
      throw new Error(
        "GHL_LOCATION_ID_TAG_GROWTH not configured in environment",
      );
    }
    return tagGrowthId;
  }

  // Client roles: use their assigned location
  if (["client_owner", "client_manager", "client_closer"].includes(currentRole)) {
    if (!locations[0]) {
      throw new Error("Client has no assigned location");
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
  return [
    "tag_exec",
    "tag_csm",
    "tag_sales",
    "tag_sales_manager",
  ].includes(role);
}

/**
 * Type-safe way to check if user is a client.
 */
export function isClientUser(role: Role): boolean {
  return [
    "client_owner",
    "client_manager",
    "client_closer",
  ].includes(role);
}
