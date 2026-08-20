import "server-only";
import { cookies } from "next/headers";
import { adminAuth, SESSION_COOKIE } from "@/lib/auth/admin";
import { isRole } from "@/lib/auth/roles";

/**
 * Test auth endpoint — bypasses OTP for development.
 * Only available if TEST_AUTH_ENABLED=true in environment, AND only outside
 * production — two independent checks, since this mints a real session
 * cookie for any email/role with no password or OTP. Either check alone
 * being flipped by mistake is not enough on its own to open this up.
 */

const TEST_AUTH_ENABLED = process.env.TEST_AUTH_ENABLED === "true" && process.env.NODE_ENV !== "production";

export async function POST(request: Request) {
  if (!TEST_AUTH_ENABLED) {
    return new Response("Test auth is disabled", { status: 403 });
  }

  try {
    const body = await request.json();
    const { email, role } = body;

    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: "Missing email or role" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    if (!isRole(role)) {
      return new Response(
        JSON.stringify({ error: `Unknown role "${role}"` }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Create a custom token with role claims
    const customToken = await adminAuth().createCustomToken(email, {
      email,
      role,
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
