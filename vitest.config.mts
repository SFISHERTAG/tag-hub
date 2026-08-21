import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    /**
     * Two separate reasons to exclude, both load-bearing.
     *
     * From main: scoped to the Next app's own tests, because the default glob
     * sweeps the whole repo and collects two suites that cannot run under this
     * config — `functions/**`, whose dependencies live in functions/node_modules,
     * and `web/**`, whose specs need Angular's TestBed. Both have their own
     * runners, so collecting them here only produced permanently red files
     * everyone learned to scroll past.
     *
     * From the onboarding branch: `.claude/worktrees/**`, where isolated agent
     * worktrees live nested under this repo root, each with their own
     * mid-edit test files. Without it, `npm run test` reports failures that
     * have nothing to do with this checkout, indistinguishable from real ones.
     *
     * Vitest's defaults are replaced wholesale by this key, so the default
     * entries are restated here rather than assumed.
     */
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
      "functions/**",
      "web/**",
      "_archive/**",
      // Retired Next surfaces — see the eslint config.
      "legacy/**",
      "**/.claude/worktrees/**",
    ],
    /**
     * lib/config.ts validates at import and throws on a missing required key,
     * which is the whole point of it — but that also means a test importing
     * anything downstream of it needs a configured environment, exactly like a
     * real one. These are dummy values; nothing here reaches a live service.
     */
    env: {
      FIREBASE_API_KEY: "test-firebase-api-key",
      GOOGLE_CLOUD_PROJECT: "tag-test-project",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      // See test/stubs/server-only.ts for why.
      "server-only": path.resolve(import.meta.dirname, "./test/stubs/server-only.ts"),
    },
  },
});
