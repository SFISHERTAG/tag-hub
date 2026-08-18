/**
 * Shared safety guard for one-time Firestore seed scripts (scripts/setup-*.ts,
 * scripts/setup-*.mjs). Call assertSafeToSeed() before the first .set()/.add()/
 * .update() call so an accidental run against production fails loudly instead
 * of writing test data into it.
 *
 * Denylist, not allowlist: no dev project id is documented anywhere in this
 * repo (.env.example itself defaults GOOGLE_CLOUD_PROJECT to the production
 * id, "tag-success-hub", the same id used in cloudbuild.yaml and
 * docs/architecture.md). Guessing an unconfirmed dev id would be worse than
 * checking against the one id we know for certain is production.
 */

export const PRODUCTION_PROJECT_ID = "tag-success-hub";

/**
 * @param {Record<string, string | undefined>} env
 */
export function assertSafeToSeed(env = process.env) {
  if (env.NODE_ENV !== "development") {
    throw new Error(
      `refusing to seed: NODE_ENV is not "development" (got ${JSON.stringify(env.NODE_ENV ?? null)})`,
    );
  }

  const projectId = env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) {
    throw new Error("refusing to seed: GOOGLE_CLOUD_PROJECT is not set");
  }
  if (projectId === PRODUCTION_PROJECT_ID) {
    throw new Error(
      `refusing to seed: GOOGLE_CLOUD_PROJECT looks like production ("${PRODUCTION_PROJECT_ID}")`,
    );
  }
}
