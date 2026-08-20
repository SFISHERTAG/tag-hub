import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { adminAuth, SESSION_COOKIE } from "@/lib/auth/admin";
import {
  apiError,
  mintSessionCookieForUid,
  rejectCrossSite,
  setSessionCookie,
} from "@/lib/auth/session-cookie";

export const dynamic = "force-dynamic";

/**
 * Re-issues the session cookie on a sliding window.
 *
 * The Angular authInterceptor attempts exactly one shared refresh on a 401
 * before giving up; this is what it calls.
 *
 * Extends a live session, never resurrects a dead one: `checkRevoked` is on, so
 * a signed-out or disabled user gets 401 here exactly as anywhere else and the
 * interceptor then surfaces the original failure rather than looping.
 *
 * The custom-token exchange this used to perform inline now lives in
 * lib/auth/session-cookie.ts, shared with OTP verify and the Google callback.
 * That move also fixed a real defect: the exchange read
 * `process.env.NEXT_PUBLIC_FIREBASE_API_KEY` directly, which cloudbuild.yaml
 * defaults to an empty string and never passes as a runtime variable, so this
 * endpoint threw in production with nothing explaining why. lib/config.ts now
 * validates the key at import, failing the process at start instead.
 */
const CONTEXT = "POST /api/auth/refresh";

export async function POST(request: NextRequest) {
  const crossSite = rejectCrossSite(request, CONTEXT);
  if (crossSite) return crossSite;

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) return apiError("Not signed in", CONTEXT, 401);

  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, true);
    const sessionCookie = await mintSessionCookieForUid(decoded.uid);

    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    return setSessionCookie(response, sessionCookie);
  } catch (cause) {
    // Logged, never swallowed. A refresh failing silently is how a session
    // problem becomes an unexplained blank screen.
    console.error(`[${CONTEXT}]`, cause);
    return apiError("Could not refresh the session.", CONTEXT, 401);
  }
}
