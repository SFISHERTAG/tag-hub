import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, getLiveClaims, SESSION_COOKIE } from "./admin";
import { isRole, type Role } from "./roles";
import { listAllLocationIds } from "../ghl/tenants";
import { firestore } from "../firestore";

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

/**
 * Reads role grants out of a claims object.
 *
 * Shared by the cookie payload and the live-claims lookup, which carry the
 * same shape. Supports both the old single-role claims and the current
 * multi-role array so a session issued before the migration still resolves.
 */
function parseRoleGrants(claims: Record<string, unknown>): RoleGrant[] {
  // New format: roles array with role+locations pairs
  if (Array.isArray(claims.roles)) {
    return (claims.roles as unknown[])
      .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
      .filter((r) => isRole(r.role) && Array.isArray(r.locations))
      .map((r) => ({
        role: r.role as Role,
        locations: (r.locations as string[]).filter((l) => typeof l === "string"),
      }));
  }

  // Old format: single role with locations. Migrate to new format.
  if (isRole(claims.role)) {
    const locations = Array.isArray(claims.locations)
      ? (claims.locations as string[]).filter((l) => typeof l === "string")
      : [];
    return [{ role: claims.role as Role, locations }];
  }

  return [];
}

/** Returns the verified session, or null. Never throws for an absent session. */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  try {
    // checkRevoked: a disabled or signed-out user is rejected on their next
    // request rather than lingering until the cookie expires.
    const decoded = await adminAuth().verifySessionCookie(cookie, true);

    /*
     * Roles come from the *live* claims, not from the cookie.
     *
     * The cookie's claims are a 14-day-old snapshot taken at sign-in.
     * `checkRevoked` above notices a disabled or signed-out user; it does not
     * notice that an admin changed someone's role, so a downgrade did not
     * take effect until that user next signed in. Someone moved off a client
     * account, or demoted out of admin, kept their old access for up to two
     * weeks.
     *
     * `getLiveClaims` caches for a minute, so this is not a round trip per
     * request, and grants made through lib/auth/admin.ts clear the entry
     * immediately. If the lookup itself fails the cookie's claims stand:
     * an Admin SDK blip signing every user out is a worse failure than a
     * downgrade landing a few seconds late.
     */
    let claims: Record<string, unknown> = decoded;
    try {
      const live = await getLiveClaims(decoded.uid);
      if (live) claims = live;
    } catch (error) {
      console.error(`[getSession] Live claims lookup failed for ${decoded.uid}, using cookie claims:`, error);
    }

    const roleGrants = parseRoleGrants(claims);

    // Fallback: no valid roles means unauthenticated. This is also what a
    // full revoke looks like now: claims cleared, next request signed out.
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
    if (currentRole === "tag_exec" || currentRole === "tag_csd" || currentRole === "admin") {
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
 * Tenant ownership.
 *
 * Every server action and route handler that accepts a caller-supplied
 * tenant-scoped id (`locationId`, `orgId`, `clientId`, `campaignId`) has to
 * check that id against the caller's own session. A role check alone is not
 * enough: `client_closer` is a legitimate role, but it is legitimate for
 * exactly one tenant, and nothing about the role says which. Before this
 * gate existed the check was written per-call-site, which meant it was
 * mostly not written at all.
 *
 * `ownsLocation` is the single predicate. Everything below is a thin wrapper
 * that decides what to do when it returns false — redirect, throw, or return
 * a typed result — so the access rule itself lives in one place.
 */

/** Roles whose remit is the whole book of business, not one tenant. */
const ALL_TENANT_ROLES: readonly Role[] = ["admin", "tag_exec", "tag_csd"];

/**
 * TAG staff. Internal roles see across tenants by design (the CS coverage
 * model: a CSM picking up a peer's book during PTO is a feature, see
 * `getClientsForCsm`). Client roles never do.
 */
const INTERNAL_ROLES: readonly Role[] = [
  "admin",
  "tag_exec",
  "tag_csd",
  "tag_csm",
  "tag_sales_manager",
  "tag_sales",
  "tag_setter_manager",
  "tag_setter",
];

/** Thrown when a session is valid but the requested tenant is not theirs. */
export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Thrown when there is no valid session at all. */
export class UnauthenticatedError extends Error {
  readonly status = 401;
  constructor(message = "Not signed in.") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

/** True if `role` belongs to TAG staff rather than a client tenant. */
export function isInternalRole(role: Role): boolean {
  return INTERNAL_ROLES.includes(role);
}

/**
 * The one access predicate. Never redirects and never throws, so it is safe
 * in a route handler, a server action, or a page.
 */
export async function ownsLocation(session: Session, locationId: string): Promise<boolean> {
  if (!locationId) return false;

  if (ALL_TENANT_ROLES.includes(session.currentRole)) return true;

  if (session.locations.includes(locationId)) return true;

  // A CSM's static grant doesn't include their whole book — client
  // assignment is dynamic (Firestore, not custom claims). Entering a client
  // tenant (Story 3.3) is what grants access, scoped to exactly the location
  // that was entered, by the same user who entered it, and only for as long
  // as the impersonation cookie lives.
  if (session.currentRole === "tag_csm") {
    const impersonation = await getImpersonation();
    if (impersonation && impersonation.locationId === locationId && impersonation.actorId === session.uid) {
      return true;
    }
  }

  return false;
}

/**
 * Enforces that the session has access to the requested location.
 * Redirects an unauthenticated caller to sign-in and throws 403 otherwise.
 * Use in pages and server components; route handlers want
 * `requireOwnedLocation` instead, which throws rather than redirecting.
 */
export async function requireLocationAccess(locationId: string): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/signin");
  if (await ownsLocation(session, locationId)) return;

  throw new ForbiddenError(
    `403 Forbidden: location ${locationId} not in permitted locations: ${session.locations.join(", ")}`,
  );
}

/**
 * Same check as `requireLocationAccess`, but throws `UnauthenticatedError`
 * instead of issuing a redirect, and hands back the session so the caller
 * does not resolve it twice. This is the form route handlers and server
 * actions want: a `redirect()` thrown out of a POST handler surfaces as an
 * opaque failure rather than a 401.
 */
export async function requireOwnedLocation(locationId: string): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthenticatedError();
  if (await ownsLocation(session, locationId)) return session;

  throw new ForbiddenError(`Location ${locationId} is not available to this account.`);
}

/**
 * Enforces that the caller is TAG staff. Cross-tenant reads by internal
 * roles are intentional (coverage), so the gate for those paths is "are you
 * staff at all", not "is this tenant yours" — but it still has to be asked.
 */
export async function requireInternalRole(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthenticatedError();
  if (!isInternalRole(session.currentRole)) {
    throw new ForbiddenError("This data is available to TAG staff only.");
  }
  return session;
}

/**
 * Resolves a `clients/{clientId}` document to its tenant and enforces that
 * the caller may see it.
 *
 * The CSM surfaces are keyed by Firestore client id rather than GHL location
 * id, so they need their own resolution step — but the rule underneath is
 * the same one `ownsLocation` applies. Internal roles pass on the coverage
 * model (any CSM can pull up a peer's book, deliberately); a client-tenant
 * role has to actually own the location the client record points at.
 *
 * Returns the resolved location id so the caller does not read the document
 * a second time.
 */
export async function requireOwnedClient(
  clientId: string,
): Promise<{ session: Session; locationId: string | null }> {
  const session = await getSession();
  if (!session) throw new UnauthenticatedError();

  // Staff see across the book by design. Skip the document read entirely
  // rather than paying for it on every internal dashboard fetch.
  if (isInternalRole(session.currentRole)) {
    return { session, locationId: null };
  }

  if (!clientId) throw new ForbiddenError("No client specified.");

  const doc = await firestore().collection("clients").doc(clientId).get();
  if (!doc.exists) {
    // Deliberately the same error a forbidden client gets: a client role
    // must not be able to probe which client ids exist.
    throw new ForbiddenError(`Client ${clientId} is not available to this account.`);
  }

  const locationId = doc.data()?.ghl_location_id;
  if (typeof locationId !== "string" || !(await ownsLocation(session, locationId))) {
    throw new ForbiddenError(`Client ${clientId} is not available to this account.`);
  }

  return { session, locationId };
}
