import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, SESSION_COOKIE } from "./admin";
import { isRole, ROLES, type Role } from "./roles";
import { listAllLocationIds } from "../ghl/tenants";

/**
 * Server-side session resolution.
 *
 * This is the secure check. `proxy.ts` only looks for the presence of a cookie
 * so it can redirect early — it does not and must not decide who anyone is.
 * Every server component and action that touches data calls through here, so a
 * forged or expired cookie is rejected at the point it would matter.
 *
 * A user can have multiple roles, each with their own locations. The `currentRole`
 * is the role they're actively using (stored in a cookie). The `availableRoles`
 * lists all roles they can switch to. `effectiveRole` refuses any role the user
 * does not have, so tampering with the role cookie changes nothing.
 */

export const ROLE_COOKIE = "hub_role";
export const IMPERSONATION_COOKIE = "hub_impersonation";

export type RoleGrant = {
  role: Role;
  locations: string[];
};

export type ImpersonationState = {
  locationId: string;
  /** Audit doc id from the "impersonation.enter" event — carried through as the exit event's correlation id. */
  auditEntryId: string;
  /** The real, authenticated user who entered — never the impersonated tenant. */
  actorId: string;
};

/**
 * Reads the impersonation cookie, if any. Does not validate that `actorId`
 * matches the current session — callers that need that (requireLocationAccess)
 * check it themselves, since this can be called before a session is resolved.
 */
export async function getImpersonation(): Promise<ImpersonationState | null> {
  const jar = await cookies();
  const raw = jar.get(IMPERSONATION_COOKIE)?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ImpersonationState>;
    if (
      typeof parsed.locationId === "string" &&
      typeof parsed.auditEntryId === "string" &&
      typeof parsed.actorId === "string"
    ) {
      return parsed as ImpersonationState;
    }
    return null;
  } catch {
    return null;
  }
}

export type Session = {
  uid: string;
  email: string | null;
  currentRole: Role;
  availableRoles: Role[];
  locations: string[];
};

/** Returns the verified session, or null. Never throws for an absent session. */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  try {
    // checkRevoked: a disabled or signed-out user is rejected on their next
    // request rather than lingering until the cookie expires.
    const decoded = await adminAuth().verifySessionCookie(cookie, true);

    // Support both old single-role and new multi-role custom claims for migration.
    let roleGrants: RoleGrant[] = [];

    // New format: roles array with role+locations pairs
    if (Array.isArray(decoded.roles)) {
      roleGrants = (decoded.roles as unknown[])
        .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
        .filter((r) => isRole(r.role) && Array.isArray(r.locations))
        .map((r) => ({
          role: r.role as Role,
          locations: (r.locations as string[]).filter((l) => typeof l === "string"),
        }));
    }
    // Old format: single role with locations. Migrate to new format.
    else if (isRole(decoded.role)) {
      const locations = Array.isArray(decoded.locations)
        ? (decoded.locations as string[]).filter((l) => typeof l === "string")
        : [];
      roleGrants = [{ role: decoded.role as Role, locations }];
    }

    // Fallback: no valid roles means unauthenticated.
    if (roleGrants.length === 0) return null;

    // Determine current role from cookie, or use first available.
    const requestedRole = jar.get(ROLE_COOKIE)?.value;
    const availableRoles = roleGrants.map((r) => r.role);
    const currentRole: Role = isRole(requestedRole) && availableRoles.includes(requestedRole)
      ? (requestedRole as Role)
      : availableRoles[0];

    // Locations for the current role.
    const currentGrant = roleGrants.find((r) => r.role === currentRole);
    let locations = currentGrant?.locations ?? [];

    // tag_exec, tag_csd, and admin get all known locations dynamically —
    // a CS Director's whole-department view needs every client's location
    // reachable, not just the ones on their own individual grant.
    if (
      currentRole === ROLES.TAG_EXEC ||
      currentRole === ROLES.TAG_CSD ||
      currentRole === ROLES.ADMIN
    ) {
      locations = await listAllLocationIds();
    }

    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      currentRole,
      availableRoles,
      locations,
    };
  } catch {
    // Expired, revoked, malformed, or forged — all mean "not signed in".
    return null;
  }
}

/** Returns the session or redirects to sign-in. Use in protected pages. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/signin");
  return session;
}

/**
 * Enforces that the session has access to the requested location.
 * Throws 403 if not permitted. Call this before every GHL request.
 */
export async function requireLocationAccess(locationId: string): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/signin");

  // tag_exec, tag_csd, and admin can access any location
  if (
    session.currentRole === ROLES.TAG_EXEC ||
    session.currentRole === ROLES.TAG_CSD ||
    session.currentRole === ROLES.ADMIN
  )
    return;

  if (session.locations.includes(locationId)) return;

  // A CSM's static grant doesn't include their whole book — client
  // assignment is dynamic (Firestore, not custom claims). Entering a client
  // tenant (Story 3.3) is what grants access, scoped to exactly the location
  // that was entered, by the same user who entered it, and only for as long
  // as the impersonation cookie lives.
  if (session.currentRole === ROLES.TAG_CSM) {
    const impersonation = await getImpersonation();
    if (impersonation && impersonation.locationId === locationId && impersonation.actorId === session.uid) {
      return;
    }
  }

  throw new Error(
    `403 Forbidden: location ${locationId} not in permitted locations: ${session.locations.join(", ")}`,
  );
}
