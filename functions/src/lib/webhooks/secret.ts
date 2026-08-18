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
