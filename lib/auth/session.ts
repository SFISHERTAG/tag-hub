import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, SESSION_COOKIE } from "./admin";
import { effectiveHat, isRole, type Role } from "./roles";
import { listAllLocationIds } from "../ghl/tenants";

/**
 * Server-side session resolution.
 *
 * This is the secure check. `proxy.ts` only looks for the presence of a cookie
 * so it can redirect early — it does not and must not decide who anyone is.
 * Every server component and action that touches data calls through here, so a
 * forged or expired cookie is rejected at the point it would matter.
 *
 * `role` comes from the verified custom claim and is the permission ceiling.
 * `hat` is the view currently chosen and comes from a plain cookie — it is not
 * a permission and is never trusted as one. `effectiveHat` refuses any hat the
 * role may not wear, so tampering with that cookie changes nothing.
 *
 * Permitted locations land on the session in Story 1.4. Until then a verified
 * session carries identity and role only.
 */

export const HAT_COOKIE = "hub_hat";

export type Session = {
  uid: string;
  email: string | null;
  role: Role;
  hat: Role;
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

    // A user with no role claim gets the least privileged one rather than a
    // default that happens to be convenient.
    const role: Role = isRole(decoded.role) ? decoded.role : "client_closer";
    const hat = effectiveHat(role, jar.get(HAT_COOKIE)?.value);

    // Locations come from custom claims. tag_exec gets all known locations.
    // Other roles get an explicit list from claims.
    let locations: string[] = [];
    if (role === "tag_exec") {
      locations = await listAllLocationIds();
    } else if (Array.isArray(decoded.locations)) {
      locations = decoded.locations.filter((l) => typeof l === "string");
    }

    return { uid: decoded.uid, email: decoded.email ?? null, role, hat, locations };
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

  // tag_exec can access any location
  if (session.role === "tag_exec") return;

  // Other roles must have the location in their permitted list
  if (!session.locations.includes(locationId)) {
    throw new Error(
      `403 Forbidden: location ${locationId} not in permitted locations: ${session.locations.join(", ")}`,
    );
  }
}
