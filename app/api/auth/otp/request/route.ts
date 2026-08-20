import { NextResponse, type NextRequest } from "next/server";
import { adminAuth } from "@/lib/auth/admin";
import { issueCode } from "@/lib/auth/otp";
import { sendMail, signInCodeMail } from "@/lib/auth/mailer";
import { signInLink } from "@/lib/auth/base-url";

export const dynamic = "force-dynamic";

/**
 * Whether a lookup failure means "no such account".
 *
 * Narrow on purpose. Every other code the Admin SDK can raise here —
 * `auth/internal-error` for a transport or credential problem,
 * `auth/invalid-credential` for an unusable service account — describes our
 * infrastructure rather than the address, and must not be answered with
 * success.
 */
function isUserNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "auth/user-not-found"
  );
}

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
  } catch (error) {
    if (!isUserNotFound(error)) {
      /**
       * An unknown address and a broken backend are not the same thing, and
       * this branch used to conflate them. Local credentials missing a quota
       * project made every lookup fail with a 403; the catch reported success,
       * so the UI showed a code on its way while nothing was issued, stored, or
       * sent. Hours went into the mail provider before the console line that
       * had the answer got read.
       *
       * Failing loudly costs nothing here: an infrastructure error says only
       * that the server is unwell, which is equally true for addresses that
       * exist and addresses that do not. The oracle the silent path guards
       * against needs the response to vary with existence, and it still does
       * not — both cases below return the same 200.
       */
      console.error("OTP request failed during user lookup:", error);
      return NextResponse.json(
        { error: "Could not send a code. Try again." },
        { status: 500 },
      );
    }

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

    /**
     * The link is an enhancement; the code is the product.
     *
     * `signInLink` throws when `PUBLIC_BASE_URL` is unset or unusable, and
     * letting that propagate would mean one missing config value locks
     * everybody out of the Hub rather than costing them one click. That is the
     * same shape of failure as the empty Firebase substitution that shipped a
     * sign-in page which could not verify anything.
     *
     * Not a silent catch: the reason is logged at error level, and the code
     * still goes out. Only the convenience is lost, and it is lost visibly.
     */
    let link: string | undefined;
    try {
      link = signInLink(email, outcome.code);
    } catch (error) {
      console.error(
        "Sign-in link omitted from the code email; sending the code alone:",
        error,
      );
    }

    await sendMail(signInCodeMail(email, outcome.code, link));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("OTP request failed:", error);
    return NextResponse.json(
      { error: "Could not send a code. Try again." },
      { status: 500 },
    );
  }
}
