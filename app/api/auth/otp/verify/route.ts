import { NextResponse, type NextRequest } from "next/server";
import { adminAuth } from "@/lib/auth/admin";
import { verifyCode } from "@/lib/auth/otp";
import {
  apiError,
  mintSessionCookieForUid,
  rejectCrossSite,
  setSessionCookie,
} from "@/lib/auth/session-cookie";
import { resolveSession } from "@/lib/auth/session";
import { buildSessionPayload } from "@/lib/auth/session-payload";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  invalid: "That code is not right.",
  expired: "That code has expired. Request a new one.",
  "too-many-attempts": "Too many attempts. Request a new code.",
};

/**
 * Verifies a code and ESTABLISHES THE SESSION.
 *
 * This route used to return a Firebase custom token in a JSON body, which the
 * browser exchanged with the Firebase Web SDK before posting the resulting ID
 * token to /api/auth/session. Two problems with carrying that into Angular.
 *
 * First, a custom token is a bearer credential for that uid, valid for an hour,
 * handed to page JavaScript in a readable body. Anything that can read that
 * response can mint a session as that user.
 *
 * Second, the migration decision is that the browser holds no Firebase SDK at
 * all — no dependency, no client-side auth state. So the exchange happens here,
 * through the same lib/auth/session-cookie.ts helper that refresh and the Google
 * callback use, and the browser receives only a Set-Cookie and its session.
 *
 * Error bodies are ApiError, not `{ error }`. The Angular errorInterceptor reads
 * `message` off the parsed body, so the old shape would have surfaced "Http
 * failure response for /api/auth/otp/verify: 401 Unauthorized" to a user who
 * simply mistyped a digit.
 */
const CONTEXT = "POST /api/auth/otp/verify";

export async function POST(request: NextRequest) {
  const crossSite = rejectCrossSite(request, CONTEXT);
  if (crossSite) return crossSite;

  let email: string | undefined;
  let code: string | undefined;

  try {
    const body: unknown = await request.json();
    const parsed = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    email = typeof parsed.email === "string" ? parsed.email.trim() : undefined;
    code = typeof parsed.code === "string" ? parsed.code.trim() : undefined;
  } catch {
    return apiError("Malformed request.", CONTEXT, 400);
  }

  if (!email || !code) {
    return apiError("Email and code are both required.", CONTEXT, 400);
  }

  try {
    const result = await verifyCode(email, code);

    if (!result.ok) {
      return apiError(MESSAGES[result.reason] ?? MESSAGES.invalid, CONTEXT, 401);
    }

    // Re-resolve the user rather than trusting the posted email: the code was
    // bound to this address at issue time, and this is the only place a uid is
    // chosen.
    const user = await adminAuth().getUserByEmail(email);
    const sessionCookie = await mintSessionCookieForUid(user.uid);

    // Resolve from the cookie we just minted, with no requested hat, so the
    // caller lands on their first available role. Nothing is read from the
    // incoming jar: a previous user's hub_role must not select the hat for a
    // session that was just created for someone else.
    const session = await resolveSession(sessionCookie, undefined);
    if (!session) {
      // Authenticated by code, but carrying no role grants, so nothing in the
      // app is reachable. Saying so beats a cookie that reads as signed out.
      return apiError("This account is not set up for TAG Hub.", CONTEXT, 403);
    }

    const response = NextResponse.json(buildSessionPayload(session, null), {
      headers: { "Cache-Control": "no-store" },
    });
    return setSessionCookie(response, sessionCookie);
  } catch (error) {
    console.error(`[${CONTEXT}]`, error);
    return apiError("Could not verify that code.", CONTEXT, 500);
  }
}
