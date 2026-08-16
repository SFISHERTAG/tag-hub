import { NextResponse, type NextRequest } from "next/server";
import { adminAuth } from "@/lib/auth/admin";
import { verifyCode } from "@/lib/auth/otp";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  invalid: "That code is not right.",
  expired: "That code has expired. Request a new one.",
  "too-many-attempts": "Too many attempts. Request a new code.",
};

/**
 * Verifies a code and returns a Firebase custom token.
 *
 * The custom token is exchanged in the browser for an ID token, which is then
 * posted to /api/auth/session for the httpOnly session cookie. Reusing that
 * route means there is exactly one place a session is created, regardless of
 * how the user proved who they are.
 */
export async function POST(request: NextRequest) {
  let email: string | undefined;
  let code: string | undefined;

  try {
    const body = await request.json();
    email = typeof body?.email === "string" ? body.email.trim() : undefined;
    code = typeof body?.code === "string" ? body.code.trim() : undefined;
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!email || !code) {
    return NextResponse.json(
      { error: "Email and code are both required." },
      { status: 400 },
    );
  }

  try {
    const result = await verifyCode(email, code);

    if (!result.ok) {
      return NextResponse.json(
        { error: MESSAGES[result.reason] ?? MESSAGES.invalid },
        { status: 401 },
      );
    }

    // Re-resolve the user rather than trusting the posted email: the code was
    // bound to this address at issue time, and this is the only place a uid is
    // chosen.
    const user = await adminAuth().getUserByEmail(email);
    const customToken = await adminAuth().createCustomToken(user.uid);

    return NextResponse.json({ ok: true, customToken });
  } catch (error) {
    console.error("OTP verify failed:", error);
    return NextResponse.json(
      { error: "Could not verify that code." },
      { status: 500 },
    );
  }
}
