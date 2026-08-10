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
  const provider = process.env.MAIL_PROVIDER?.trim();

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

export function signInCodeMail(email: string, code: string): Mail {
  return {
    to: email,
    subject: `${code} is your TAG Hub sign-in code`,
    text: [
      `Your sign-in code is ${code}`,
      "",
      "It expires in 10 minutes and can only be used once.",
      "If you did not request it, you can ignore this email.",
    ].join("\n"),
  };
}
