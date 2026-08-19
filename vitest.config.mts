import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    /**
     * Scoped to the Next app's own tests. Without this, the default glob sweeps
     * the whole repo and collects two suites that cannot run under this config:
     * `functions/**`, whose dependencies (express, firebase-functions) are
     * installed in functions/node_modules and not here, and `web/**`, whose
     * specs need Angular's TestBed environment and globals. Both have their own
     * runners — `npm test` inside functions/, and `npm run web:test` from the
     * repo root — so collecting them here only produced three permanently red
     * files that everyone learned to scroll past.
     */
    exclude: ["**/node_modules/**", "**/dist/**", "functions/**", "web/**", "_archive/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      // See test/stubs/server-only.ts for why.
      "server-only": path.resolve(import.meta.dirname, "./test/stubs/server-only.ts"),
    },
  },
});
