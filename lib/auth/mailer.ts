import "server-only";

/**
 * Delivery for sign-in codes.
 *
 * Deliberately behind an interface. No transactional email provider has been
 * chosen yet, and the OTP logic should not have to change when one is.
 *
 * In development with no provider configured, the code is written to the server
 * console so sign-in is testable end to end. That path refuses to run in
 * production — a deployment that silently logged codes instead of sending them
 * would look like it worked while locking everyone out.
 */

export type Mail = {
  to: string;
  subject: string;
  text: string;
};

export class MailerNotConfiguredError extends Error {
  constructor() {
    super(
      "No email provider configured. Set MAIL_PROVIDER and its credentials, " +
        "or run in development where codes are logged to the console.",
    );
    this.name = "MailerNotConfiguredError";
  }
}

async function sendViaConsole(mail: Mail): Promise<void> {
  console.log(
    [
      "",
      "──────────────── SIGN-IN CODE (development only) ────────────────",
      `  to:      ${mail.to}`,
      `  subject: ${mail.subject}`,
      "",
      mail.text.split("\n").map((line) => `  ${line}`).join("\n"),
      "─────────────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
}

export async function sendMail(mail: Mail): Promise<void> {
  const provider = process.env.MAIL_PROVIDER?.trim() || undefined;

  if (provider === "gmail") {
    const { sendViaGmail } = await import("./gmail");
    return sendViaGmail(mail);
  }

  if (!provider) {
    if (process.env.NODE_ENV === "production") {
      throw new MailerNotConfiguredError();
    }
    return sendViaConsole(mail);
  }

  throw new Error(
    `MAIL_PROVIDER="${provider}" is set but no implementation exists for it yet.`,
  );
}

/**
 * The sign-in code email.
 *
 * Shaped for the on-device scanners in iOS and macOS Mail, which offer a code
 * for one-tap autofill only when they can identify it. Two things decide that:
 * the word "code" sitting immediately against the digits, and the digits being
 * the only number in the message. Both the subject and the opening line follow
 * the first rule, and the expiry is spelled out rather than written as "10
 * minutes" to satisfy the second, since a competing number is the usual reason
 * a code stops being detected. Keep it that way when editing this copy.
 */
export function signInCodeMail(email: string, code: string): Mail {
  return {
    to: email,
    subject: `${code} is your TAG Hub verification code`,
    text: [
      `Your TAG Hub verification code is ${code}`,
      "",
      "The code expires in ten minutes and can only be used once.",
      "If you did not request it, you can ignore this email.",
    ].join("\n"),
  };
}
