import { NextResponse, type NextRequest } from "next/server";
import { adminAuth, SESSION_COOKIE } from "@/lib/auth/admin";
import { getImpersonation } from "@/lib/auth/session";
import { clearAuthCookies } from "@/lib/auth/session-cookie";
import { closeImpersonationEntry } from "@/lib/audit/store";

export const dynamic = "force-dynamic";

/**
 * Clears the session and revokes the user's refresh tokens.
 *
 * Revoking matters: without it, a session cookie copied off the machine stays
 * valid until it expires. `verifySessionCookie(cookie, true)` in
 * lib/auth/session.ts checks revocation, so signing out here invalidates every
 * session that user has anywhere.
 *
 * Two response modes, chosen by Accept. The Angular client asks for JSON and
 * navigates itself; the existing Next form post still needs a redirect. Both
 * branches do exactly the same work — the difference is only what comes back,
 * so a caller cannot get a weaker sign-out by asking for one shape or the other.
 *
 * Deliberately no cross-site check. Signing someone out is not a privilege
 * escalation, and refusing to clear a session because the request looked odd is
 * the wrong failure direction for this particular endpoint.
 */
export async function POST(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  let uid: string | null = null;

  if (cookie) {
    try {
      // checkRevoked false: an already-expired cookie should still let us
      // identify the user well enough to revoke and to close their audit entry.
      const decoded = await adminAuth().verifySessionCookie(cookie, false);
      uid = decoded.sub;
      await adminAuth().revokeRefreshTokens(decoded.sub);
    } catch {
      // Already invalid. Clearing the cookies is still the right outcome.
    }
  }

  // Close any open impersonation before the cookie goes. Signing out mid-tenant
  // otherwise leaves an entry with no exit time, which reads as access that
  // never ended.
  const impersonation = await getImpersonation();
  if (impersonation && uid && impersonation.actorId === uid) {
    await closeImpersonationEntry(impersonation.locationId, impersonation.auditEntryId, uid);
  }

  const wantsJson = request.headers.get("accept")?.includes("application/json") ?? false;

  const response = wantsJson
    ? NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
    : // A host-RELATIVE Location, resolved by the browser against the request it
      // already made. Building an absolute URL from `request.nextUrl.origin`
      // reads the container's own bind address inside Cloud Run, so signing out
      // sent people to https://0.0.0.0:8080/signin. Confirmed in production
      // before the fix; see test/signout-redirect.test.ts.
      //
      // Relative needs no host detection, no x-forwarded-* parsing and no
      // configured base URL, so it cannot drift per environment.
      //
      // 303, not the default 307. A 307 preserves the method, so the browser
      // would re-POST to /signin.
      new NextResponse(null, { status: 303, headers: { Location: "/signin" } });

  // All three cookies, on both branches. Clearing only the session leaves
  // hub_role and hub_impersonation behind, so the next person to sign in on a
  // shared machine inherits a stale hat and a banner naming a tenant they have
  // no relationship to.
  return clearAuthCookies(response);
}
