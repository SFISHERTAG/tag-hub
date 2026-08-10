import "server-only";
import { GoogleAuth } from "google-auth-library";
import type { Mail } from "./mailer";

/**
 * Sends mail through Google Workspace using the Gmail API.
 *
 * Domain-wide delegation, done without a service account key file. The usual
 * recipe distributes a private key and asks you to protect it forever; instead
 * the IAM Credentials API signs the assertion on the service account's behalf,
 * so the only thing that needs protecting is an IAM binding — revocable,
 * auditable, and impossible to leak in a commit.
 *
 * The exchange, once per token:
 *   1. Build a JWT claiming to be the service account, acting for the sender
 *   2. Have IAM sign it (`signJwt`) using ADC
 *   3. Trade the signed assertion for an access token
 *   4. Send the message
 *
 * Setup this depends on, one time, in the Workspace Admin console:
 *   Security → Access and data control → API controls
 *   → Domain-wide delegation → Add new
 *     Client ID: 102839561497136967158
 *     Scope:     https://www.googleapis.com/auth/gmail.send
 */

const SCOPE = "https://www.googleapis.com/auth/gmail.send";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SERVICE_ACCOUNT =
  process.env.GMAIL_SERVICE_ACCOUNT?.trim() ||
  "hub-app@tag-success-hub.iam.gserviceaccount.com";

export class GmailNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GmailNotConfiguredError";
  }
}

function sender(): string {
  const from = process.env.GMAIL_SENDER?.trim();
  if (!from) {
    throw new GmailNotConfiguredError(
      "GMAIL_SENDER is not set. It must be a mailbox in your Workspace domain, " +
        "for example noreply@taxadvisorygrowth.net.",
    );
  }
  return from;
}

/** Access token cache — these last an hour, so re-minting per email is waste. */
let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: SERVICE_ACCOUNT,
    sub: sender(), // the mailbox being acted for — the delegation itself
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const signResponse = await client.request<{ signedJwt: string }>({
    url:
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/` +
      `${encodeURIComponent(SERVICE_ACCOUNT)}:signJwt`,
    method: "POST",
    data: { payload: JSON.stringify(payload) },
  });

  const signedJwt = signResponse.data.signedJwt;

  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  });

  const body = await tokenResponse.text();
  if (!tokenResponse.ok) {
    throw new GmailNotConfiguredError(
      `Gmail token exchange failed (${tokenResponse.status}): ${body.slice(0, 300)}. ` +
        `If this says "unauthorized_client", domain-wide delegation has not been ` +
        `granted for client ID 102839561497136967158 with scope ${SCOPE}.`,
    );
  }

  const parsed = JSON.parse(body) as {
    access_token: string;
    expires_in: number;
  };

  cached = {
    token: parsed.access_token,
    expiresAt: Date.now() + parsed.expires_in * 1000,
  };
  return parsed.access_token;
}

/** RFC 2822 message, base64url encoded as Gmail expects. */
function encodeMessage(mail: Mail, from: string): string {
  const headers = [
    `From: TAG Hub <${from}>`,
    `To: ${mail.to}`,
    `Subject: ${mail.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    mail.text,
  ].join("\r\n");

  return Buffer.from(headers)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendViaGmail(mail: Mail): Promise<void> {
  const from = sender();
  const token = await accessToken();

  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodeMessage(mail, from) }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Gmail send failed (${response.status}): ${detail.slice(0, 300)}`,
    );
  }
}
