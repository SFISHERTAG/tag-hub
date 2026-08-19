import { NextResponse, type NextRequest } from "next/server";
import { adminAuth, SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/auth/admin";
import type { ApiError } from "@/lib/api/errorInterceptor";

export const dynamic = "force-dynamic";

/**
 * Re-issues the session cookie on a sliding window.
 *
 * The Angular authInterceptor is required to attempt exactly one shared refresh
 * on a 401 before giving up. It previously pointed at `GET /api/auth/session`,
 * which is POST-only, so the attempt 405'd — and the interceptor ordering meant
 * it never ran at all. This is the endpoint it should have been calling.
 *
 * Firebase has no "refresh a session cookie" primitive: `createSessionCookie`
 * takes an ID token, not another session cookie. Since the decision for this
 * migration is that the browser never holds a Firebase SDK or a refresh token,
 * the round trip has to happen server-side — mint a custom token for the uid the
 * current cookie proves, exchange it for an ID token, and mint a fresh session
 * cookie from that.
 *
 * This extends a live session; it cannot resurrect a dead one. `checkRevoked`
 * is on, so a signed-out or disabled user gets 401 here exactly as they would
 * anywhere else, and the interceptor then surfaces the original failure rather
 * than looping.
 */

const IDENTITY_TOOLKIT_URL =
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken";

function unauthorized(message: string): NextResponse<ApiError> {
  const body: ApiError = { message, context: "POST /api/auth/refresh", status: 401 };
  return NextResponse.json(body, { status: 401 });
}

/**
 * Exchanges a custom token for an ID token via the Identity Toolkit REST API.
 * The Admin SDK deliberately has no method for this — signing in is a client
 * operation — so the REST call is the supported server-side route.
 */
async function exchangeCustomTokenForIdToken(customToken: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    // Thrown rather than returned so it lands in the catch below and is logged
    // as a server fault. A missing key is a deploy error, not a bad request.
    throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY is not set");
  }

  const response = await fetch(`${IDENTITY_TOOLKIT_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });

  if (!response.ok) {
    throw new Error(`Identity Toolkit exchange failed: ${response.status}`);
  }

  const body: unknown = await response.json();
  const idToken =
    typeof body === "object" && body !== null ? (body as { idToken?: unknown }).idToken : undefined;

  if (typeof idToken !== "string") {
    throw new Error("Identity Toolkit exchange returned no ID token");
  }

  return idToken;
}

export async function POST(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) return unauthorized("Not signed in");

  try {
    // checkRevoked: an expired, revoked or forged cookie must not be extended.
    const decoded = await adminAuth().verifySessionCookie(cookie, true);

    const customToken = await adminAuth().createCustomToken(decoded.uid);
    const idToken = await exchangeCustomTokenForIdToken(customToken);
    const sessionCookie = await adminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });
    return response;
  } catch (cause) {
    // Logged, never swallowed — a refresh failing silently is how a session
    // problem turns into an unexplained blank screen.
    console.error("[POST /api/auth/refresh]", cause);
    return unauthorized("Could not refresh the session.");
  }
}
