import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, SESSION_COOKIE } from "./admin";

/**
 * Server-side session resolution.
 *
 * This is the secure check. `proxy.ts` only looks for the presence of a cookie
 * so it can redirect early — it does not and must not decide who anyone is.
 * Every server component and action that touches data calls through here, so a
 * forged or expired cookie is rejected at the point it would matter.
 *
 * Role and permitted locations land on the session in Story 1.4. Until then a
 * verified session carries identity only, and no route makes a decision based
 * on more than "is this a real, current user".
 */

export type Session = {
  uid: string;
  email: string | null;
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
    return { uid: decoded.uid, email: decoded.email ?? null };
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
