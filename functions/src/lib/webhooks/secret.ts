import { timingSafeEqual } from "node:crypto";

/**
 * Validates a webhook caller's bearer token, without ever blocking the
 * request on it — Phase 3 doesn't send one yet, and Phase 2's callers only
 * started sending one recently, so a hard 401 here would break callers
 * this repo doesn't fully control the rollout of. Every case still logs a
 * warning, so a misconfigured secret or a caller that silently stopped
 * sending its token is visible in the logs instead of invisible.
 */
export function checkWebhookSecret(
  source: string,
  req: { header(name: string): string | undefined },
  expectedEnvVar: string,
): void {
  const authHeader = req.header("authorization") ?? req.header("Authorization");

  if (!authHeader) {
    console.warn(`[${source}] No Authorization header on this webhook call — expected a Bearer token.`);
    return;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) {
    console.warn(`[${source}] Authorization header present but not a well-formed Bearer token.`);
    return;
  }

  const expected = process.env[expectedEnvVar];
  if (!expected) {
    console.warn(
      `[${source}] Caller sent a bearer token but ${expectedEnvVar} isn't configured here — can't validate it.`,
    );
    return;
  }

  if (match[1] !== expected) {
    console.warn(`[${source}] Bearer token did not match ${expectedEnvVar}.`);
  }
}

/** Constant-time compare, so a rejected token leaks nothing by how fast it failed. */
function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type SecretCheck = { ok: true } | { ok: false; status: 401 | 500; message: string };

/**
 * Blocking counterpart to `checkWebhookSecret`.
 *
 * The warn-only version above is a deliberate compromise for callers whose
 * rollout this repo does not control. It is the wrong compromise where the
 * webhook's own effect is to grant access: Phase 1 provisioning takes the
 * contact email straight from the request body and writes it to the OTP
 * whitelist, the Firestore list that gates real sign-in. An unauthenticated
 * call there provisions real GHL/Slack/Drive resources and hands the caller
 * a working login, so that endpoint rejects rather than warns.
 *
 * A missing `expectedEnvVar` is a 500, not a pass. Failing open on a
 * misconfigured deploy is exactly the shape of bug this is here to prevent.
 */
export function requireWebhookSecret(
  source: string,
  req: { header(name: string): string | undefined },
  expectedEnvVar: string,
): SecretCheck {
  const expected = process.env[expectedEnvVar]?.trim();
  if (!expected) {
    console.error(
      `[${source}] ${expectedEnvVar} is not configured — refusing the request rather than accepting it unverified.`,
    );
    return { ok: false, status: 500, message: "Webhook authentication is not configured." };
  }

  const authHeader = req.header("authorization") ?? req.header("Authorization");
  const match = authHeader ? /^Bearer\s+(.+)$/i.exec(authHeader) : null;

  if (!match || !tokensMatch(match[1].trim(), expected)) {
    console.warn(`[${source}] Rejected a webhook call with a missing or invalid bearer token.`);
    return { ok: false, status: 401, message: "Unauthorized." };
  }

  return { ok: true };
}
