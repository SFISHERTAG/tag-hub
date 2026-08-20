#!/usr/bin/env node
/**
 * Points git at the tracked hooks in scripts/hooks.
 *
 * Idempotent, and safe to re-run. Reports what it changed rather than doing it
 * silently, because core.hooksPath is repo-wide: it applies to the main
 * checkout and every worktree at once, so it is worth being loud about.
 */
import { execFileSync } from "node:child_process";

const TARGET = "scripts/hooks";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

let current = "";
try {
  current = git("config", "--get", "core.hooksPath");
} catch {
  // Unset. Git's own default is .git/hooks.
}

if (current === TARGET) {
  console.log(`✓ core.hooksPath already points at ${TARGET}`);
  process.exit(0);
}

git("config", "core.hooksPath", TARGET);

if (current) {
  console.log(`✓ core.hooksPath: ${current} -> ${TARGET}`);
  console.log(`  The previous path was outside version control; anything custom`);
  console.log(`  there is still on disk but no longer runs.`);
} else {
  console.log(`✓ core.hooksPath set to ${TARGET} (was unset, defaulting to .git/hooks)`);
}
console.log("  This applies to the main checkout and every worktree.");
