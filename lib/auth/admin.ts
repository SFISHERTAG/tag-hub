import "server-only";
import { getAuth, type Auth } from "firebase-admin/auth";
import { initializeApp, getApp, cert } from "firebase-admin/app";
import type { Role } from "./roles";

/**
 * Firebase Admin SDK for user management.
 * Credentials must come from env (GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_ADMIN_KEY).
 */

/**
 * Name of the session cookie.
 *
 * `proxy.ts` declares this same literal independently, and must keep doing so:
 * middleware runs on the edge runtime and importing this module — which is
 * `server-only` and pulls in the whole Admin SDK — would not bundle there. The
 * duplication is deliberate; the comment in each file points at the other.
 */
export const SESSION_COOKIE = "hub_session";

/** Fourteen days, in milliseconds. Firebase caps session cookies at 14 days. */
export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

let cached: Auth | null = null;

/**
 * The Admin Auth handle, initialised on first use.
 *
 * Lazy rather than module-scope so importing this file does not throw in
 * environments without credentials — a build step or a unit test that only
 * needs `SESSION_COOKIE` should not need a service account.
 */
export function adminAuth(): Auth {
  if (cached) return cached;

  let app;
  try {
    app = getApp();
  } catch {
    /**
     * Two credential paths, and the production one carries no secret.
     *
     * On Cloud Run the runtime service account supplies Application Default
     * Credentials, so `initializeApp()` with no argument is both sufficient and
     * preferable: there is no service-account JSON to store, rotate, or leak,
     * and the identity is the one Story 1.7 AC #4 asks for — Firestore user and
     * Secret Manager accessor, nothing more.
     *
     * `FIREBASE_ADMIN_KEY` is the local-development path only. The previous
     * form always called `cert()` and fell back to `JSON.parse("{}")` when the
     * variable was absent, which throws an opaque credential error rather than
     * saying what is missing — and would have failed on Cloud Run, where the
     * variable is deliberately not set.
     */
    const key = process.env.FIREBASE_ADMIN_KEY;

    /**
     * `serviceAccountId` is what lets `createCustomToken` work without a key
     * file, and sign-in cannot complete without it.
     *
     * Minting a custom token means signing a JWT, and user credentials cannot
     * sign. With nothing named here the SDK asks the GCE metadata server which
     * service account it is; on a laptop that is `ENOTFOUND metadata` surfacing
     * as an opaque `auth/invalid-credential`, after the code has already been
     * accepted and consumed. Naming the account sends the signing to the IAM
     * API instead — the keyless path `gmail.ts` already uses, on the same
     * `serviceAccountTokenCreator` binding.
     *
     * The default is not a guess: `cloudbuild.yaml` deploys Cloud Run with
     * `--service-account=hub-app@…`, so naming it here is the same identity
     * metadata discovery would return in production, and the same one
     * `gmail.ts` already signs as. Production behaviour is unchanged; local
     * development stops needing a key file.
     */
    const serviceAccountId =
      process.env.FIREBASE_SERVICE_ACCOUNT_ID?.trim() ||
      "hub-app@tag-success-hub.iam.gserviceaccount.com";

    app = key
      ? initializeApp({ credential: cert(JSON.parse(key)) })
      : initializeApp({ serviceAccountId });
  }

  cached = getAuth(app);
  return cached;
}

/** @deprecated Use `adminAuth()`. Kept so in-flight callers keep compiling. */
export const getAdminAuth = adminAuth;

/**
 * Set role and locations custom claims on a user.
 * Admin action — only call from server-side operations.
 */
export async function setUserClaims(
  uid: string,
  role: Role,
  locations: string[],
): Promise<void> {
  await getAdminAuth().setCustomUserClaims(uid, {
    role,
    locations,
  });
}

/**
 * Set a user's role to tag_exec (all locations).
 */
export async function promoteToExec(uid: string): Promise<void> {
  await setUserClaims(uid, "tag_exec", []);
}

/**
 * Get a user's custom claims.
 */
export async function getUserClaims(uid: string): Promise<Record<string, unknown> | undefined> {
  const user = await getAdminAuth().getUser(uid);
  return user.customClaims;
}
