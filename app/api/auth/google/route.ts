import { NextResponse, type NextRequest } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { adminAuth } from "@/lib/auth/admin";
import { config, isGoogleSigninConfigured } from "@/lib/config";
import {
  apiError,
  mintSessionCookieForUid,
  rejectCrossSite,
  setSessionCookie,
} from "@/lib/auth/session-cookie";
import { resolveSession } from "@/lib/auth/session";
import { buildSessionPayload } from "@/lib/auth/session-payload";

export const dynamic = "force-dynamic";

/**
 * Exchanges a Google Identity Services credential for a Hub session.
 *
 * The browser sends the `credential` from the GIS button callback. That is an ID
 * token, not an access token: it proves who the person is and grants no API
 * scopes, which is why sign-in needs only the non-sensitive openid/email/profile
 * scopes and no Google verification.
 *
 * From there it joins the same path OTP takes — mintSessionCookieForUid, then
 * resolveSession against the cookie we just minted — so there is exactly one
 * implementation of "turn a known identity into a session".
 */
const CONTEXT = "POST /api/auth/google";

/**
 * Constructed without arguments deliberately. verifyIdToken checks the token's
 * `aud` against the audience passed per call, so the client needs no credentials
 * of its own; it only fetches and caches Google's public signing keys.
 */
const oauthClient = new OAuth2Client();

export async function POST(request: NextRequest) {
  const crossSite = rejectCrossSite(request, CONTEXT);
  if (crossSite) return crossSite;

  // 503 rather than a 500 or a silent pass. An unconfigured deployment is a
  // deploy-time omission, and the button is hidden client-side when the id is
  // absent, so reaching here at all means the two halves disagree.
  if (!isGoogleSigninConfigured()) {
    return apiError("Google sign-in is not configured.", CONTEXT, 503);
  }

  let credential: string | undefined;
  try {
    const body: unknown = await request.json();
    const parsed = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    credential = typeof parsed.credential === "string" ? parsed.credential : undefined;
  } catch {
    return apiError("Malformed request.", CONTEXT, 400);
  }

  if (!credential) {
    return apiError("Missing credential.", CONTEXT, 400);
  }

  try {
    // verifyIdToken checks the signature against Google's keys, that `aud`
    // equals our client id, that `iss` is Google, and that it has not expired.
    // The audience check is the one that matters most here: without it, an ID
    // token minted for any other Google app would be accepted.
    const ticket = await oauthClient.verifyIdToken({
      idToken: credential,
      audience: config.googleSigninClientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return apiError("Could not verify that Google account.", CONTEXT, 401);
    }

    // An unverified address must not be trusted: Google accounts can carry an
    // email the holder never proved they control, and we match users by email.
    if (payload.email_verified !== true || !payload.email) {
      return apiError("That Google account has no verified email address.", CONTEXT, 401);
    }

    // Matching on email rather than `sub`, which is a deliberate trade. Google's
    // guidance is to key on `sub` because an address can change, and it is right
    // — but nothing in this codebase stores `sub` on the Firebase user record,
    // so sub matching needs a backfill first. The live hazard until then: a
    // Workspace mailbox rename silently breaks that person's Google sign-in.
    // They can still use a code, and story 10.7 carries the backfill.
    let uid: string;
    try {
      const user = await adminAuth().getUserByEmail(payload.email);
      uid = user.uid;
    } catch {
      // No auto-provisioning. There is no self-signup anywhere in this app, and
      // an auto-created user would carry no role grants, so they would receive a
      // cookie and then read as signed out — an unexplained bounce with nothing
      // to act on. Matches what OTP request does for an unknown address.
      return apiError("This account is not set up for TAG Hub.", CONTEXT, 401);
    }

    const sessionCookie = await mintSessionCookieForUid(uid);

    // No requested hat, and nothing read from the incoming jar: a previous
    // user's hub_role must not choose the hat for a session just minted for
    // someone else.
    const session = await resolveSession(sessionCookie, undefined);
    if (!session) {
      return apiError("This account is not set up for TAG Hub.", CONTEXT, 403);
    }

    const response = NextResponse.json(buildSessionPayload(session, null), {
      headers: { "Cache-Control": "no-store" },
    });
    return setSessionCookie(response, sessionCookie);
  } catch (error) {
    // Covers a forged or expired credential, a wrong audience, and an Identity
    // Toolkit failure. Deliberately one message: distinguishing them tells a
    // caller which half of a guess was right.
    console.error(`[${CONTEXT}]`, error);
    return apiError("Could not verify that Google account.", CONTEXT, 401);
  }
}
