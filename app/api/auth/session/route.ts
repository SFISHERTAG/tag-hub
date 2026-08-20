import { NextResponse, type NextRequest } from "next/server";
import {
  adminAuth,
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
} from "@/lib/auth/admin";
import { getSession, getImpersonation } from "@/lib/auth/session";
import { buildSessionPayload } from "@/lib/auth/session-payload";
import { apiError } from "@/lib/auth/session-cookie";

export const dynamic = "force-dynamic";

const GET_CONTEXT = "GET /api/auth/session";

/**
 * The session probe. HttpRbacService calls this once at bootstrap, before any
 * guard runs, and again after anything that could change the session.
 *
 * Deliberately anonymous-capable: it uses getSession() rather than
 * requireApiSession(), because "signed out" is a legitimate answer here, not an
 * error condition to log on every cold load by a visitor who has never signed
 * in. It still answers 401 so the client has a status to branch on.
 *
 * The 401 carries no detail. getSession()'s catch already collapses expired,
 * revoked, malformed and forged into a single null (lib/auth/session.ts:131),
 * and distinguishing them for the caller would tell an attacker which half of a
 * guess was right.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return apiError("Not signed in", GET_CONTEXT, 401);

  // The read-only probe is the ONE place that derives impersonation from the
  // incoming cookie jar. Every mutating route passes the state it is writing.
  const impersonation = await getImpersonation();

  return NextResponse.json(buildSessionPayload(session, impersonation), {
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Exchanges a freshly minted Firebase ID token for an httpOnly session cookie.
 *
 * The ID token itself is never stored. It is short-lived and readable by any
 * script on the page; a session cookie is httpOnly, server-verifiable, and
 * revocable. The client holds the ID token only long enough to post it here.
 */
export async function POST(request: NextRequest) {
  let idToken: string | undefined;

  try {
    const body = await request.json();
    idToken = typeof body?.idToken === "string" ? body.idToken : undefined;
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!idToken) {
    return NextResponse.json({ error: "Missing ID token." }, { status: 400 });
  }

  try {
    // Verifying first means a forged token never reaches cookie creation.
    await adminAuth().verifyIdToken(idToken, true);

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
  } catch {
    // Deliberately vague: distinguishing "expired" from "invalid" tells an
    // attacker which half of a guess was right.
    return NextResponse.json(
      { error: "Could not establish a session." },
      { status: 401 },
    );
  }
}
