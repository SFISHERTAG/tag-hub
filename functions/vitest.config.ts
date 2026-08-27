import { defineConfig } from "vitest/config";

/**
 * Without a config here, vitest walks up and finds the root `vitest.config.mts`,
 * which is a different workspace with different deps and cannot resolve
 * `vitest/config` from `functions/node_modules`. The failure is a resolution
 * error rather than a test failure, so it reads as "broken tooling" instead of
 * "wrong config" and costs a while to place.
 *
 * `functions/` is a separate workspace on purpose (its own lockfile, its own
 * @google-cloud/firestore major), so it needs its own runner config too.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
