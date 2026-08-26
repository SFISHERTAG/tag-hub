import { defineConfig } from "vitest/config";

/**
 * functions/ needs its own config, not just the vitest devDependency.
 *
 * Without a config file here, vitest walks up and loads the root
 * `vitest.config.mts`, which then cannot resolve `vitest/config` from the
 * root's node_modules while running against this workspace. The failure reads
 * as an unrelated module-resolution error, so the missing piece is this file
 * rather than the dependency.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
