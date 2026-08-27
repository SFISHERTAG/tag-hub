import "server-only";
import { getAuth, type Auth } from "firebase-admin/auth";
import { initializeApp, getApp, cert } from "firebase-admin/app";
import {
  assertTeamUidsExist,
  assertWithinClaimLimit,
  normaliseGrants,
  type GrantInput,
} from "./grants";
import { ROLES } from "./roles";

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
 * How long a user's custom claims are trusted from cache.
 *
 * Claims are baked into the session cookie at sign-in, and that cookie lives
 * for 14 days. `checkRevoked` catches a disabled or signed-out user, but it
 * does not notice that an admin changed someone's role — so a downgrade did
 * not take effect until the user happened to sign in again, up to two weeks
 * later. Re-reading the live claims fixes that, and this cache is what stops
 * it costing an Admin SDK round trip on every single request.
 *
 * Sixty seconds is the worst-case delay on a downgrade now. Grants made
 * through this module clear the entry immediately, so the TTL only matters
 * for changes made elsewhere (the Firebase console, another instance).
 */
const CLAIMS_TTL_MS = 60 * 1000;

const claimsCache = new Map<string, { claims: Record<string, unknown> | undefined; expiresAt: number }>();

/**
 * The user's current custom claims, cached briefly.
 *
 * Returns `undefined` if the lookup fails, so the caller can decide. It
 * deliberately does not throw: an Admin SDK blip should not sign every
 * signed-in user out.
 */
export async function getLiveClaims(uid: string): Promise<Record<string, unknown> | undefined> {
  const cached = claimsCache.get(uid);
  if (cached && cached.expiresAt > Date.now()) return cached.claims;

  const user = await getAdminAuth().getUser(uid);
  claimsCache.set(uid, { claims: user.customClaims, expiresAt: Date.now() + CLAIMS_TTL_MS });
  return user.customClaims;
}

/**
 * Drops a user's cached claims.
 *
 * Only clears this instance. On a multi-instance deploy the others fall back
 * to CLAIMS_TTL_MS, which is the ceiling on how stale any of them can be.
 */
export function invalidateClaimsCache(uid: string): void {
  claimsCache.delete(uid);
}

/**
 * Set role and locations custom claims on a user.
 * Stores multiple role grants.
 * Admin action — only call from server-side operations.
 */
export async function setUserClaims(
  uid: string,
  roleGrants: readonly GrantInput[],
): Promise<void> {
  // Validation is in lib/auth/grants.ts rather than here so it is provable
  // without Firebase. Order matters: normalise first so the size check measures
  // what would actually be written, and resolve team members before writing
  // anything, so a bad uid costs nothing rather than half a team.
  const grants = normaliseGrants(uid, roleGrants);
  const claims = { roles: grants };
  assertWithinClaimLimit(claims);
  await assertTeamUidsExist(grants, async (memberUids) => {
    // One batch lookup; getUsers reports not-found identifiers in the result
    // rather than throwing, so a transient Admin SDK failure propagates as
    // itself instead of masquerading as "user does not exist". The 100-id
    // batch cap is unreachable: the claim byte limit caps a team far below it.
    const result = await getAdminAuth().getUsers(memberUids.map((uid) => ({ uid })));
    return result.notFound.map((identifier) =>
      "uid" in identifier ? identifier.uid : JSON.stringify(identifier),
    );
  });

  await getAdminAuth().setCustomUserClaims(uid, claims);
  // A downgrade that waits out the TTL on the instance that performed it
  // would be a strange thing to explain to whoever just made the change.
  invalidateClaimsCache(uid);
}

/**
 * Set a user's role to tag_exec (all locations).
 *
 * The role came from a string literal until story 14.B. That is the most
 * dangerous place in the repo for one: this is the claim-ISSUING path, and
 * CLAUDE.md names a "tag_admin" versus "admin" mismatch as the exact failure
 * the role constraint exists to prevent. A typo here writes a claim nothing
 * grants against, and the user is silently locked out rather than refused.
 */
export async function promoteToExec(uid: string): Promise<void> {
  await setUserClaims(uid, [{ role: ROLES.TAG_EXEC, locations: [] }]);
}

/**
 * Get a user's custom claims.
 */
export async function getUserClaims(uid: string): Promise<Record<string, unknown> | undefined> {
  const user = await getAdminAuth().getUser(uid);
  return user.customClaims;
}
