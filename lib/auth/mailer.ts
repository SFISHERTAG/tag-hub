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
  /** Optional HTML alternative. Senders fall back to `text` when absent. */
  html?: string;
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
 *
 * The sign-in link carries the same six digits in its fragment, which is the
 * one place a second run of numbers is safe: any digits a parser finds there
 * are the code, so a confused parser still extracts the right answer. That is
 * not true of an unrelated number like a duration.
 *
 * The link exists because Apple's autofill only reaches Safari and native apps.
 * In Chrome or Arc on macOS no amount of formatting produces a suggestion, and
 * the alternative is asking people to copy digits by hand.
 */
export function signInCodeMail(email: string, code: string, link?: string): Mail {
  const text = [
    `Your TAG Hub verification code is ${code}`,
    "",
    ...(link ? [`Or sign in directly: ${link}`, ""] : []),
    "The code expires in ten minutes and can only be used once.",
    "If you did not request it, you can ignore this email.",
  ].join("\n");

  return {
    to: email,
    subject: `${code} is your TAG Hub verification code`,
    text,
    html: link ? signInCodeHtml(code, link) : undefined,
  };
}

/**
 * HTML alternative.
 *
 * The code is repeated as selectable text above the button rather than living
 * only inside the link, so the message still works when a client blocks the
 * button, when the recipient is on a device that is not the one holding their
 * mail, and for Apple's scanner.
 *
 * Inline styles only, and a table for the button: every mail client strips
 * `<style>` blocks, and several still lay out with tables.
 */
function signInCodeHtml(code: string, link: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#0b0b0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:420px;margin:0 auto;text-align:center;">
      <p style="margin:0 0 8px;font-size:14px;color:#a1a1aa;">
        Your TAG Hub verification code is
      </p>
      <p style="margin:0 0 24px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;letter-spacing:8px;color:#ffffff;">
        ${code}
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px;">
        <tr>
          <td style="border-radius:6px;background:#c9a227;">
            <a href="${link}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#1a1a1a;text-decoration:none;">
              Click here to sign in
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:12px;color:#71717a;">
        The code expires in ten minutes and can only be used once.<br />
        If you did not request it, you can ignore this email.
      </p>
    </div>
  </body>
</html>`;
}
