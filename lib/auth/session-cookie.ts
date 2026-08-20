import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { adminAuth, SESSION_COOKIE, SESSION_MAX_AGE_MS } from "./admin";
import { ROLE_COOKIE, IMPERSONATION_COOKIE } from "./session";
import { config } from "../config";
import type { ApiError } from "../api/errorInterceptor";

/**
 * Everything involved in turning "we know who this is" into a session cookie.
 *
 * Three routes need this chain — OTP verify, the Google callback, and refresh —
 * and it was written once inline in refresh. Writing it three times is how the
 * Origin check below ends up on two of them and not the third.
 *
 * Firebase has no primitive for minting a session cookie from a uid:
 * `createSessionCookie` takes an ID token, and obtaining one is nominally a
 * client operation. Since the decision for this migration is that the browser
 * holds no Firebase SDK, the round trip happens here: custom token -> Identity
 * Toolkit REST -> ID token -> session cookie. The custom token never leaves the
 * server, which matters because it is a bearer credential for that uid.
 */

const IDENTITY_TOOLKIT_URL =
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken";

export function apiError(message: string, context: string, status: number): NextResponse<ApiError> {
  const body: ApiError = { message, context, status };
  console.error(`[${context}]`, `${status} ${message}`);
  return NextResponse.json(body, {
    status,
    // A session-bearing or auth-failing response must not be stored by a browser
    // or an intermediary. `dynamic = "force-dynamic"` stops Next caching the
    // render; it says nothing about the response body downstream.
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Rejects cross-site requests to session-minting endpoints.
 *
 * This repo had no CSRF machinery of any kind — no Origin check, no
 * Sec-Fetch-Site check, no token, nothing. With `hub_session` set SameSite=lax,
 * a cross-site POST does not carry the victim's cookie, so classic CSRF against
 * an authenticated action is limited. The live risk is the opposite direction:
 * LOGIN CSRF. An attacker's page POSTs their own credential to a session-minting
 * endpoint, the browser stores the resulting cookie, and the victim is now
 * silently signed in as the attacker — every subsequent action lands in the
 * attacker's account, which is a session-fixation primitive.
 *
 * Two checks, both cheap:
 *
 * - Origin must match this deployment. A cross-site form post either omits
 *   Origin or carries the attacker's; a same-origin fetch always carries ours.
 * - Content-Type must be JSON. `request.json()` parses a body regardless of
 *   Content-Type, so without this a simple HTML form (which cannot set custom
 *   headers, and so cannot be sent as application/json cross-site) reaches the
 *   handler. This is the check that actually blocks the no-JS attack.
 *
 * Returns null when the request is acceptable.
 */
export function rejectCrossSite(
  request: NextRequest,
  context: string,
): NextResponse<ApiError> | null {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return apiError("Expected application/json.", context, 415);
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    // A same-origin fetch from the app always sends Origin on a POST. An absent
    // one is a non-browser client or a form post, neither of which should be
    // minting sessions.
    return apiError("Missing Origin.", context, 403);
  }

  if (config.appOrigin) {
    if (origin !== config.appOrigin) {
      return apiError("Cross-site request refused.", context, 403);
    }
    return null;
  }

  // With APP_ORIGIN unset, compare hosts rather than full origins. Protocol is
  // unreliable here: behind Cloud Run the app sees http internally while the
  // browser sent https, and in development ng serve proxies :4200 to :3000
  // without rewriting Host. Host equality is the part that actually
  // distinguishes same-site from cross-site.
  const host = request.headers.get("host");
  if (!host) return apiError("Missing Host.", context, 403);

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return apiError("Malformed Origin.", context, 403);
  }

  if (originHost !== host) {
    return apiError("Cross-site request refused.", context, 403);
  }

  return null;
}

/**
 * Exchanges a custom token for an ID token through the Identity Toolkit REST
 * API. The Admin SDK has no method for this by design — signing in is nominally
 * a client operation — so REST is the supported server-side route.
 */
async function exchangeCustomTokenForIdToken(customToken: string): Promise<string> {
  const response = await fetch(`${IDENTITY_TOOLKIT_URL}?key=${config.firebaseApiKey}`, {
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

/** Mints a session cookie value for a uid we have already authenticated. */
export async function mintSessionCookieForUid(uid: string): Promise<string> {
  const customToken = await adminAuth().createCustomToken(uid);
  const idToken = await exchangeCustomTokenForIdToken(customToken);
  return adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
}

const COOKIE_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;

/** Sets the session cookie on a response. */
export function setSessionCookie<T>(response: NextResponse<T>, value: string): NextResponse<T> {
  response.cookies.set(SESSION_COOKIE, value, {
    ...COOKIE_BASE,
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });
  return response;
}

/**
 * Clears every auth cookie.
 *
 * All three, always. Clearing only `hub_session` leaves `hub_role` and
 * `hub_impersonation` behind, so the next person to sign in on that machine
 * inherits a stale hat and, worse, an impersonation banner naming a tenant they
 * have no relationship to.
 */
export function clearAuthCookies<T>(response: NextResponse<T>): NextResponse<T> {
  for (const name of [SESSION_COOKIE, ROLE_COOKIE, IMPERSONATION_COOKIE]) {
    response.cookies.set(name, "", { ...COOKIE_BASE, maxAge: 0 });
  }
  return response;
}
