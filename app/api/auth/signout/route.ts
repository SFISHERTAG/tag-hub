import { NextResponse, type NextRequest } from "next/server";
import { adminAuth, SESSION_COOKIE } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

/**
 * Clears the session cookie and revokes the user's refresh tokens.
 *
 * Revoking matters: without it, a session cookie copied off the machine stays
 * valid until it expires. `verifySessionCookie(cookie, true)` in
 * `lib/auth/session.ts` checks revocation, so signing out here invalidates
 * every session that user has anywhere.
 */
export async function POST(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;

  if (cookie) {
    try {
      const decoded = await adminAuth().verifySessionCookie(cookie, false);
      await adminAuth().revokeRefreshTokens(decoded.sub);
    } catch {
      // Already invalid — clearing the cookie is still the right outcome.
    }
  }

  /**
   * A relative Location, and 303 rather than a redirect built from the origin.
   *
   * `request.nextUrl.origin` is the container's own bind address inside Cloud
   * Run, so this sent people to `https://0.0.0.0:8080/signin`. Cloud Run's
   * proxy does not rewrite the request URL Next sees in a route handler, and
   * `HOSTNAME=0.0.0.0` / `PORT=8080` is what it reports. The proxy layer avoids
   * this by emitting relative redirects; route handlers have to do it by hand.
   *
   * A relative Location is resolved by the browser against the request it
   * already made, which is right by construction and needs no host detection,
   * no `x-forwarded-*` parsing, and no environment-specific base URL.
   *
   * 303 rather than the 307 `NextResponse.redirect` defaults to: 307 preserves
   * the method, which would re-POST to the sign-in page.
   */
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: "/signin" },
  });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
