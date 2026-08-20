import "server-only";

/**
 * The one place that reads environment configuration and decides whether it
 * is usable.
 *
 * CLAUDE.md prescribes this file by name, and it did not exist. In its
 * absence, four separate modules each wrote
 * `process.env.GOOGLE_CLOUD_PROJECT || "tag-success-hub"` — a fallback to
 * the real production project id. A developer who forgot to export the
 * variable did not get an error; they got a working app pointed at live
 * client data, and every write landed in production.
 *
 * So the rule here is: no default that is also a real environment. A missing
 * required key throws, loudly, naming the key. An app that will not start is
 * a far better outcome than one that starts against the wrong project.
 *
 * Scope: this covers the config where a wrong value silently destroys or
 * leaks real data. The GHL, Meta, Slack and Drive integrations still read
 * their own `process.env` at their own call sites, each with its own
 * "not configured" error path; consolidating those is a follow-up, and
 * lower-stakes because none of them fall back to a production identity.
 */

/** True while `next build` is running, when no runtime env is expected. */
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";
/** True under vitest, which has no deployment to be wrong about. */
const IS_TEST = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

/** Config is validated when the app actually runs, not while it is compiled. */
const SHOULD_VALIDATE = !IS_BUILD && !IS_TEST;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

function readRequired(name: string, why: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;

  const message =
    `${name} is not set. ${why}\n` +
    `Set it in .env.local for local development, or in the deployment's environment. ` +
    `There is deliberately no default: the previous default was the production project id, ` +
    `which meant a missing variable wrote to live client data instead of failing.`;

  if (SHOULD_VALIDATE) throw new ConfigError(message);

  // During build and test, defer the failure to first real use rather than
  // breaking compilation on a machine that has no deployment config.
  console.warn(`[config] ${name} is not set (build/test context, not failing yet).`);
  return "";
}

/** The GCP project every Firestore client in the app connects to. */
export function gcpProjectId(): string {
  const value = readRequired(
    "GOOGLE_CLOUD_PROJECT",
    "It selects which GCP project Firestore reads and writes.",
  );
  if (!value) {
    throw new ConfigError(
      "GOOGLE_CLOUD_PROJECT is not set. Refusing to connect Firestore to an unknown project.",
    );
  }
  return value;
}

/**
 * True when this process is running against the production GCP project.
 * Scripts that write real data use this to refuse, or to demand an explicit
 * opt-in, rather than discovering it afterwards.
 */
export function isProductionProject(projectId = process.env.GOOGLE_CLOUD_PROJECT?.trim()): boolean {
  return projectId === PRODUCTION_PROJECT_ID;
}

/**
 * Named so it can be recognised and refused, not so it can be defaulted to.
 * Nothing in this file falls back to it.
 */
export const PRODUCTION_PROJECT_ID = "tag-success-hub";

/**
 * Called at import time by the modules that connect to Firestore, so a
 * misconfigured deployment fails on start rather than on the first request
 * that happens to touch the database.
 */
export function assertRuntimeConfig(): void {
  if (!SHOULD_VALIDATE) return;
  gcpProjectId();
}
