import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, SESSION_COOKIE } from "./admin";
import { hasAnyRole, isRole, ROLES, type Role } from "./roles";
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
  /**
   * Whose rows this hat sees within its locations. Optional because every
   * claim issued before this field existed omits it; `resolveScope` supplies a
   * role-derived default (lib/dashboard/scope.ts) rather than guessing here.
   */
  scope?: "self" | "team" | "tenancy";
  /** uids this hat may see, when `scope` is "team". */
  team?: string[];
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
  /** Scope carried by the *current* grant only — hats scope independently. */
  scope?: "self" | "team" | "tenancy";
  /** Team uids on the current grant, when its scope is "team". */
  team?: string[];
};

/** Returns the verified session, or null. Never throws for an absent session. */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  return resolveSession(cookie, jar.get(ROLE_COOKIE)?.value);
}

/**
 * Resolves a session from a cookie value and a requested hat, without reading
 * the cookie jar.
 *
 * Split out of getSession() so a route that is about to CHANGE the hat can
 * resolve the resulting session before writing the cookie. Deriving it any other
 * way leaks: `locations` for tag_exec, tag_csd and admin is every known
 * location, so carrying the old hat's list into a narrower one would report
 * tenant access the new hat does not have.
 *
 * `requestedRole` is still validated against the caller's own grants here, so
 * passing an arbitrary value cannot widen anything.
 */
export async function resolveSession(
  cookie: string,
  requestedRole: string | undefined,
): Promise<Session | null> {
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
          // Anything unrecognised is dropped rather than passed through, so a
          // malformed claim cannot widen scope — resolveScope then falls back
          // to the role default and, failing that, to "self".
          scope:
            r.scope === "self" || r.scope === "team" || r.scope === "tenancy"
              ? r.scope
              : undefined,
          team: Array.isArray(r.team)
            ? (r.team as unknown[]).filter((u): u is string => typeof u === "string")
            : undefined,
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

    // Determine current role from the request, or use first available.
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
      scope: currentGrant?.scope,
      team: currentGrant?.team,
    };
  } catch {
    // Expired, revoked, malformed, or forged — all mean "not signed in".
    return null;
  }
}

/** Returns the session or redirects to sign-in. Use in protected pages. */
/**
 * TAG-side roles — the ones that may act on the product itself rather than
 * inside one tenancy.
 *
 * An allowlist, deliberately, and not the inverse of `isClientUser`
 * (lib/dashboard/location-selection.ts). That helper names only three of the
 * five client roles — `client_setter` and `client_setter_manager` are absent —
 * so `!isClientUser(role)` would report those two as internal and hand a
 * client's setter the staff path through `authorizeOnboardingTrigger`.
 *
 * Written positively so the failure direction is safe: a role added to ROLES
 * later is not internal until someone adds it here on purpose.
 */
const INTERNAL_ROLES: readonly Role[] = [
  ROLES.ADMIN,
  ROLES.TAG_EXEC,
  ROLES.TAG_CSD,
  ROLES.TAG_CSM,
  ROLES.TAG_SALES_MANAGER,
  ROLES.TAG_SALES,
  ROLES.TAG_SETTER_MANAGER,
  ROLES.TAG_SETTER,
];

export function isInternalRole(role: Role): boolean {
  return INTERNAL_ROLES.includes(role);
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/signin");
  return session;
}

/**
 * Returns the session if its current role is one of `allowed`, otherwise
 * throws. Unlike `requireSession`, this never redirects — it's for server
 * actions and API routes that are directly callable in their own right (not
 * just reached through a component tree that already filtered the UI), where
 * a thrown error becomes a normal failure result instead of a navigation.
 */
export async function requireRole(allowed: readonly Role[]): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  if (!hasAnyRole(session.currentRole, allowed)) {
    throw new Error(`Not authorized: role "${session.currentRole}" cannot perform this action.`);
  }
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
