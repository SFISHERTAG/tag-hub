import { NextResponse, type NextRequest } from "next/server";
import { adminAuth } from "@/lib/auth/admin";
import { issueCode } from "@/lib/auth/otp";
import { sendMail, signInCodeMail } from "@/lib/auth/mailer";

export const dynamic = "force-dynamic";

/**
 * Issues a sign-in code.
 *
 * Always reports success, whether or not the address belongs to a user. There
 * is no self-signup, so an endpoint that distinguished the two would be a
 * membership oracle — anyone could learn which of TAG's clients have accounts.
 */
export async function POST(request: NextRequest) {
  let email: string | undefined;

  try {
    const body = await request.json();
    email = typeof body?.email === "string" ? body.email.trim() : undefined;
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  try {
    // Existence is checked, but never revealed.
    await adminAuth().getUserByEmail(email);
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    const outcome = await issueCode(email);

    if (!outcome.sent) {
      return NextResponse.json(
        {
          ok: true,
          cooldown: true,
          retryAfterSeconds: Math.ceil(outcome.retryAfterMs / 1000),
        },
        { status: 200 },
      );
    }

    await sendMail(signInCodeMail(email, outcome.code));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("OTP request failed:", error);
    return NextResponse.json(
      { error: "Could not send a code. Try again." },
      { status: 500 },
    );
  }
}
