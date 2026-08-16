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

  const response = NextResponse.redirect(new URL("/signin", request.nextUrl.origin));
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
