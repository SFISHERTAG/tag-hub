import { describe, expect, it } from "vitest";
import { assertSafeToSeed, PRODUCTION_PROJECT_ID } from "../scripts/lib/seed-guard.mjs";

/**
 * scripts/setup-*.ts and scripts/setup-*.mjs write real data straight to
 * Firestore with no confirmation prompt. assertSafeToSeed() is the one guard
 * standing between "npx ts-node scripts/setup-csm-test-data.ts" run with the
 * wrong environment and a real client record landing in production. Each
 * case here is a shape that guard must reject, plus the one shape it must
 * let through.
 */

const DEV_PROJECT_ID = "tag-success-hub-dev";

function envWith(overrides: Record<string, string | undefined>) {
  return { NODE_ENV: undefined, GOOGLE_CLOUD_PROJECT: undefined, ...overrides };
}

describe("assertSafeToSeed", () => {
  it("throws when NODE_ENV is unset", () => {
    expect(() =>
      assertSafeToSeed(envWith({ GOOGLE_CLOUD_PROJECT: DEV_PROJECT_ID })),
    ).toThrow(/NODE_ENV/);
  });

  it("throws when NODE_ENV is production", () => {
    expect(() =>
      assertSafeToSeed(
        envWith({ NODE_ENV: "production", GOOGLE_CLOUD_PROJECT: DEV_PROJECT_ID }),
      ),
    ).toThrow(/NODE_ENV/);
  });

  it("throws when GOOGLE_CLOUD_PROJECT is unset even in development", () => {
    expect(() =>
      assertSafeToSeed(envWith({ NODE_ENV: "development" })),
    ).toThrow(/GOOGLE_CLOUD_PROJECT is not set/);
  });

  it("throws when GOOGLE_CLOUD_PROJECT matches the known production id", () => {
    expect(() =>
      assertSafeToSeed(
        envWith({ NODE_ENV: "development", GOOGLE_CLOUD_PROJECT: PRODUCTION_PROJECT_ID }),
      ),
    ).toThrow(/looks like production/);
  });

  it("does not throw for development with a non-production project id", () => {
    expect(() =>
      assertSafeToSeed(
        envWith({ NODE_ENV: "development", GOOGLE_CLOUD_PROJECT: DEV_PROJECT_ID }),
      ),
    ).not.toThrow();
  });
});
