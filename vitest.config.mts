import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    /**
     * `functions/` is a separate package with its own dependencies (express
     * among them) that are not installed at the repo root, so its suites
     * fail to load here while passing under `npm run test:functions`. That
     * single red suite made the root run permanently red, which is how a
     * whole subsystem ends up outside the gate CLAUDE.md says is the gate.
     *
     * Run both: `npm run test && npm run test:functions`. The webhook suites
     * that do run at the root are excluded here too, for the same reason.
     */
    exclude: ["**/node_modules/**", "**/dist/**", "functions/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      // See test/stubs/server-only.ts for why.
      "server-only": path.resolve(import.meta.dirname, "./test/stubs/server-only.ts"),
    },
  },
});
