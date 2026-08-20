import "server-only";

/**
 * The only place in this codebase that reads `process.env`, validated at import
 * time. CLAUDE.md has required this file since the August audit; it did not
 * exist, and 26 files read `process.env` directly instead.
 *
 * 10.2 forced the issue. `app/api/auth/refresh/route.ts` read
 * `process.env.NEXT_PUBLIC_FIREBASE_API_KEY` to reach the Identity Toolkit. That
 * is a `NEXT_PUBLIC_` name, so Next inlines it at build time — and
 * `cloudbuild.yaml:24` defaults the `_FIREBASE_API_KEY` substitution to an empty
 * string while `--set-env-vars` never passes it. The endpoint therefore throws in
 * production unless the trigger happens to set that substitution, and nothing
 * anywhere said so. That is the audit's "silent fallback" pattern exactly: a
 * missing key producing a runtime failure far from its cause.
 *
 * Two rules make this file worth having:
 *
 * 1. A required key that is missing throws HERE, at import, so the process fails
 *    to start rather than failing at the first request that needed it.
 * 2. An optional key is optional ON PURPOSE and says why. There are currently two,
 *    and both are documented below.
 *
 * Migrating the other 26 readers is deliberately not part of this story. New code
 * reads from here; existing readers move in their own change.
 */

/** Thrown at import time. Deliberately not an ApiError: nothing is serving yet. */
class ConfigError extends Error {
  constructor(problems: string[]) {
    super(
      `Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join("\n")}\n` +
        `See .env.example. In deployed environments check cloudbuild.yaml's --set-env-vars.`,
    );
    this.name = "ConfigError";
  }
}

const problems: string[] = [];

function required(name: string, why: string): string {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim() === "") {
    problems.push(`${name} is required but ${value === undefined ? "unset" : "empty"}. ${why}`);
    return "";
  }
  return value;
}

function optional(name: string): string {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Server-side key for the Identity Toolkit REST exchange (custom token -> ID
 * token), used by every route that mints a session cookie.
 *
 * Reads `FIREBASE_API_KEY` first and falls back to the legacy
 * `NEXT_PUBLIC_FIREBASE_API_KEY`. The fallback exists only so an environment
 * already configured the old way keeps working; new deployments should set the
 * non-public name, because a `NEXT_PUBLIC_` value is inlined into the browser
 * bundle and its build-time-only nature is what caused the bug above.
 */
const firebaseApiKey =
  optional("FIREBASE_API_KEY") ||
  required(
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "Set FIREBASE_API_KEY (preferred, server-only) or NEXT_PUBLIC_FIREBASE_API_KEY. " +
      "Without it no session cookie can be minted, so nobody can sign in.",
  );

/**
 * The origin this deployment is served from, used to reject cross-site requests
 * to session-minting endpoints. Optional, with a deliberate consequence rather
 * than a silent one: when unset, the Origin check falls back to comparing
 * against the request's own host, which is correct for a same-origin
 * deployment and is the topology this app runs in.
 */
const appOrigin = optional("APP_ORIGIN");

/**
 * Google Identity Services sign-in client id.
 *
 * The one key that is optional by design. It cannot be created from code: it
 * requires a Web application OAuth client in the Google Cloud console with the
 * deployment's origins registered. Until it is set, `POST /api/auth/google`
 * answers 503 and the Angular sign-in screen renders OTP only. It never
 * degrades to a permissive path.
 *
 * Distinct from NEXT_PUBLIC_GOOGLE_PICKER_CLIENT_ID (.env.example:75), which is
 * the Drive Picker's client and is not an end-user sign-in credential.
 */
const googleSigninClientId = optional("GOOGLE_SIGNIN_CLIENT_ID");

if (problems.length > 0) {
  throw new ConfigError(problems);
}

export const config = {
  firebaseApiKey,
  appOrigin,
  googleSigninClientId,
} as const;

/** True when Google sign-in is configured. Callers must branch on this, not on truthiness of the id at a call site. */
export function isGoogleSigninConfigured(): boolean {
  return config.googleSigninClientId !== "";
}
