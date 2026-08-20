import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // Vitest's default exclude list doesn't know about .claude/worktrees —
    // other isolated agent worktrees live there, nested under this repo
    // root, each with their own (sometimes broken, sometimes mid-edit) test
    // files. Without this, `npm run test` reports failures that have
    // nothing to do with this checkout's actual source, indistinguishable
    // from real ones.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
      "**/.claude/worktrees/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      // See test/stubs/server-only.ts for why.
      "server-only": path.resolve(import.meta.dirname, "./test/stubs/server-only.ts"),
    },
  },
});
