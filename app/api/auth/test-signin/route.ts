import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, SESSION_COOKIE } from "@/lib/auth/admin";
import type { Role } from "@/lib/auth/roles";
import { isProductionProject } from "@/lib/config";

/**
 * Test auth endpoint — bypasses OTP for development.
 *
 * This mints a real `hub_session` cookie for any email and any role, with no
 * password, no OTP, and no check that the email belongs to a real user. It
 * was gated on one boolean, `TEST_AUTH_ENABLED`, which put a single
 * environment-variable typo between "disabled" and "instant admin access for
 * anyone who finds the URL".
 *
 * Now it needs three independent things to be true, in the order a mistake
 * is most likely to happen:
 *
 * 1. NODE_ENV is not production. A production deploy cannot enable this at
 *    all, however the flag is set.
 * 2. The GCP project is not the production one, so a local run pointed at
 *    production Firestore cannot mint sessions against real accounts.
 * 3. TEST_AUTH_ENABLED is explicitly "true".
 *
 * Same double-check the mailer's console-fallback path in this codebase
 * already does. Read per request rather than at module load so a
 * misconfiguration cannot be baked into a warm server.
 */
function testAuthRefusal(): Response | null {
  if (process.env.NODE_ENV === "production") {
    return new Response("Test auth is not available in production", { status: 403 });
  }
  if (isProductionProject()) {
    return new Response("Test auth is not available against the production project", { status: 403 });
  }
  if (process.env.TEST_AUTH_ENABLED !== "true") {
    return new Response("Test auth is disabled", { status: 403 });
  }
  return null;
}

export async function POST(request: Request) {
  const refused = testAuthRefusal();
  if (refused) return refused;

  try {
    const body = await request.json();
    const { email, role } = body;

    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: "Missing email or role" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Create a custom token with role claims
    const customToken = await adminAuth().createCustomToken(email, {
      email,
      role: role as Role,
      test_user: true,
    });

    // Exchange custom token for ID token via Firebase REST API
    const firebaseResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: customToken, returnSecureToken: true }),
      },
    );

    if (!firebaseResponse.ok) {
      throw new Error("Failed to exchange custom token");
    }

    const firebaseData = await firebaseResponse.json();
    const idToken = firebaseData.idToken;

    // Create session cookie from ID token
    const session = await adminAuth().createSessionCookie(idToken, {
      expiresIn: 60 * 60 * 24 * 5, // 5 days
    });

    const jar = await cookies();
    jar.set(SESSION_COOKIE, session, {
      maxAge: 60 * 60 * 24 * 5,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return new Response(
      JSON.stringify({ success: true, email, role }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Test auth error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create session" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
