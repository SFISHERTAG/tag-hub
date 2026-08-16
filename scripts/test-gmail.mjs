#!/usr/bin/env node
/**
 * Verifies Gmail domain-wide delegation end to end.
 *
 * Mirrors lib/auth/gmail.ts deliberately rather than importing it — that module
 * is `server-only` and cannot run outside Next. Keeping this standalone means a
 * failure here points at the delegation setup, not at the app.
 *
 * Usage:
 *   node --env-file=.env.local scripts/test-gmail.mjs recipient@example.com
 */

import { GoogleAuth } from "google-auth-library";

const SCOPE = "https://www.googleapis.com/auth/gmail.send";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SERVICE_ACCOUNT =
  process.env.GMAIL_SERVICE_ACCOUNT?.trim() ||
  "hub-app@tag-success-hub.iam.gserviceaccount.com";
const SENDER = process.env.GMAIL_SENDER?.trim();

const to = process.argv[2];

if (!SENDER) {
  console.error("GMAIL_SENDER is not set. Run with --env-file=.env.local");
  process.exit(1);
}
if (!to) {
  console.error("Usage: node --env-file=.env.local scripts/test-gmail.mjs <recipient>");
  process.exit(1);
}

console.log(`service account: ${SERVICE_ACCOUNT}`);
console.log(`sending as:      ${SENDER}`);
console.log(`recipient:       ${to}`);
console.log();

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});
const client = await auth.getClient();

const now = Math.floor(Date.now() / 1000);
const payload = {
  iss: SERVICE_ACCOUNT,
  sub: SENDER,
  scope: SCOPE,
  aud: TOKEN_URL,
  iat: now,
  exp: now + 3600,
};

console.log("1. signing assertion via IAM…");
let signedJwt;
try {
  const res = await client.request({
    url:
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/` +
      `${encodeURIComponent(SERVICE_ACCOUNT)}:signJwt`,
    method: "POST",
    data: { payload: JSON.stringify(payload) },
  });
  signedJwt = res.data.signedJwt;
  console.log("   signed ok");
} catch (err) {
  console.error("   FAILED:", err.message);
  console.error("\n   Likely cause: your ADC principal lacks");
  console.error("   roles/iam.serviceAccountTokenCreator on the service account.");
  process.exit(1);
}

console.log("2. exchanging assertion for an access token…");
const tokenRes = await fetch(TOKEN_URL, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: signedJwt,
  }),
});

const tokenBody = await tokenRes.text();
if (!tokenRes.ok) {
  console.error(`   FAILED (${tokenRes.status}): ${tokenBody.slice(0, 400)}`);
  if (tokenBody.includes("unauthorized_client")) {
    console.error("\n   Domain-wide delegation is not in effect for:");
    console.error("     Client ID: 102839561497136967158");
    console.error(`     Scope:     ${SCOPE}`);
    console.error("   Check Admin console → Security → API controls →");
    console.error("   Domain-wide delegation. Changes can take a few minutes.");
  }
  process.exit(1);
}
const { access_token } = JSON.parse(tokenBody);
console.log("   token ok");

console.log("3. sending message…");
const message = [
  `From: TAG Hub <${SENDER}>`,
  `To: ${to}`,
  "Subject: TAG Hub delegation test",
  "MIME-Version: 1.0",
  'Content-Type: text/plain; charset="UTF-8"',
  "",
  "If you are reading this, Gmail domain-wide delegation works.",
  "",
  "Sign-in codes will arrive from this address.",
].join("\r\n");

const raw = Buffer.from(message)
  .toString("base64")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");

const sendRes = await fetch(
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  },
);

const sendBody = await sendRes.text();
if (!sendRes.ok) {
  console.error(`   FAILED (${sendRes.status}): ${sendBody.slice(0, 400)}`);
  process.exit(1);
}

console.log("   sent");
console.log(`\nCheck ${to}.`);
