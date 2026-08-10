import { NextResponse, type NextRequest } from "next/server";
import {
  adminAuth,
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
} from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

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
