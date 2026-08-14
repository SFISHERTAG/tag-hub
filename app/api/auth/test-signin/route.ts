import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, SESSION_COOKIE } from "@/lib/auth/admin";
import type { Role } from "@/lib/auth/roles";

/**
 * Test auth endpoint — bypasses OTP for development.
 * Only available if TEST_AUTH_ENABLED=true in environment.
 */

const TEST_AUTH_ENABLED = process.env.TEST_AUTH_ENABLED === "true";

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

    // Create a session cookie with custom claims for the role
    const session = await adminAuth().createSessionCookie(
      {
        uid: email,
        email,
        email_verified: true,
        auth_time: Math.floor(Date.now() / 1000),
        iss: "https://securetoken.google.com/tag-success-hub",
        aud: "tag-success-hub",
        sub: email,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        firebase: {
          identities: {},
          sign_in_provider: "test",
        },
        role: role as Role,
        test_user: true,
      } as any,
      {
        expiresIn: 60 * 60 * 24 * 5, // 5 days
      },
    );

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
