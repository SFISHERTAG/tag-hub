import { getAuth } from "firebase-admin/auth";
import { initializeApp, getApps, applicationDefault } from "firebase-admin/app";

/**
 * Firebase Auth user provisioning.
 *
 * Deliberately a functions-side module rather than an import of `lib/auth/admin.ts`:
 * CLAUDE.md's architecture isolation forbids Cloud Functions importing from `app/`,
 * and that file is `server-only` besides. `functions/src/firestore.ts` exists for
 * the same reason. **The claim shape below must stay identical to
 * `setUserClaims` in lib/auth/admin.ts** — the app reads what this writes, and
 * a divergence here signs people out rather than failing loudly.
 *
 * Uses Application Default Credentials, matching google.ts's keyless approach.
 */

export type RoleGrant = {
  role: string;
  locations: string[];
  scope?: "self" | "team" | "tenancy";
};

function auth() {
  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault() });
  }
  return getAuth();
}

/**
 * The grants a newly provisioned client's first user receives.
 *
 * That person is normally the founder — whoever signed the cheque — and in a
 * small firm they are also the one working calls, so they get the working hats
 * as well as the owner view. The hat switcher moves between them.
 *
 * Three things here are load-bearing:
 *
 * 1. **`client_owner`, never `tag_exec`.** `tag_exec` is *TAG's* executive and
 *    is cross-tenancy by construction — session build replaces its locations
 *    with every known location id. Granting it to a client would show them
 *    every other client's spend and results.
 * 2. **`client_owner` is first.** With no hat cookie set — exactly a new user's
 *    state — the app falls back to the first available role. Reorder this and
 *    the founder's first ever screen is the setter view.
 * 3. **Every grant names this one location.** An empty `locations` array is the
 *    all-tenancies wildcard, not "none".
 *
 * Scope is set explicitly rather than left to the role-derived default in
 * lib/dashboard/scope.ts, so the intent is visible on the claim itself.
 */
export function clientOwnerGrants(locationId: string): RoleGrant[] {
  return [
    { role: "client_owner", locations: [locationId], scope: "tenancy" },
    { role: "client_manager", locations: [locationId], scope: "team" },
    { role: "client_closer", locations: [locationId], scope: "self" },
    { role: "client_setter_manager", locations: [locationId], scope: "team" },
    { role: "client_setter", locations: [locationId], scope: "self" },
  ];
}

/**
 * Creates the user if absent, returns the uid either way.
 *
 * Phase 1's idempotency guard covers a retried *delivery*, but not a rerun
 * after a partial failure — the guard is cleared on error precisely so the
 * webhook can be retried, and that retry reaches this function again. So this
 * tolerates the user already existing rather than treating it as a conflict.
 */
export async function ensureUser(email: string, displayName?: string): Promise<string> {
  try {
    const existing = await auth().getUserByEmail(email);
    return existing.uid;
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code !== "auth/user-not-found") throw error;
  }

  const created = await auth().createUser({
    email,
    emailVerified: false,
    displayName,
    // No password: sign-in is OTP (app/api/auth/otp/*), and the email is added
    // to the OTP whitelist alongside this call. A password would be a second
    // credential nobody issues, rotates, or revokes.
  });
  return created.uid;
}

/**
 * Merges grants onto whatever the user already holds.
 *
 * Pure and exported so the matching rule is testable without the Admin SDK —
 * this is where a mistake silently removes somebody's access.
 *
 * Overwriting would be wrong in a real case: a TAG staff member who is also an
 * owner at a client, or someone provisioned for a second tenancy, would lose
 * their existing access. Grants are keyed by role *and* location, so
 * re-provisioning the same client is idempotent while a second client is
 * additive.
 */
export function mergeGrants(
  existing: readonly RoleGrant[],
  incoming: readonly RoleGrant[],
): RoleGrant[] {
  const merged: RoleGrant[] = existing.map((g) => ({ ...g }));

  for (const grant of incoming) {
    const target = grant.locations[0];
    const match = merged.findIndex(
      (g) => g.role === grant.role && (g.locations ?? []).includes(target),
    );
    if (match === -1) merged.push({ ...grant });
    else merged[match] = { ...grant };
  }

  return merged;
}

export async function grantRoles(uid: string, grants: RoleGrant[]): Promise<void> {
  const user = await auth().getUser(uid);
  const existing = Array.isArray(user.customClaims?.roles)
    ? (user.customClaims.roles as RoleGrant[])
    : [];

  // Spread the existing claims so anything else living on them survives.
  await auth().setCustomUserClaims(uid, {
    ...user.customClaims,
    roles: mergeGrants(existing, grants),
  });
}

/** Provisions the first user for a newly cloned tenancy. Returns the uid. */
export async function provisionClientOwner(
  email: string,
  locationId: string,
  displayName?: string,
): Promise<string> {
  const uid = await ensureUser(email, displayName);
  await grantRoles(uid, clientOwnerGrants(locationId));
  return uid;
}
