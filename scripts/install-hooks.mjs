#!/usr/bin/env node
/**
 * Points git at the tracked hooks in scripts/hooks.
 *
 * Idempotent, and safe to re-run. Reports what it changed rather than doing it
 * silently, and then verifies that the setting actually took effect everywhere
 * rather than assuming it did.
 *
 * That verification is the point. core.hooksPath is repo-wide, but two things
 * quietly defeat it: a worktree can override it in its own config.worktree,
 * and scripts/hooks is per-branch so a checkout on an older branch points at
 * a directory that is not there. Either way the hooks stop running and nothing
 * says so, which is worse than never having installed them.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

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
} else {
  git("config", "core.hooksPath", TARGET);

  if (current) {
    console.log(`✓ core.hooksPath: ${current} -> ${TARGET}`);
    console.log(`  The previous path was outside version control; anything custom`);
    console.log(`  there is still on disk but no longer runs.`);
  } else {
    console.log(`✓ core.hooksPath set to ${TARGET} (was unset, defaulting to .git/hooks)`);
  }
}

/**
 * Setting the repo-level value is not the same as it taking effect.
 *
 * This comment used to claim the setting "applies to the main checkout and
 * every worktree". It does not. This repo has extensions.worktreeConfig
 * enabled, and a worktree carrying core.hooksPath in its own config.worktree
 * beats the repo-level value — Claude Code writes exactly that pin when it
 * creates a worktree, so agent worktrees ignore this script by default.
 *
 * Rather than clear those pins, which would be one agent silently rewriting
 * another agent's git config, read back what each worktree actually resolves
 * and name the ones that disagree. A partial install that reports success is
 * the failure being removed here; a human deciding what to do about a listed
 * conflict is not.
 */
function worktreePaths() {
  return git("worktree", "list", "--porcelain")
    .split("\n")
    .filter((l) => l.startsWith("worktree "))
    .map((l) => l.slice("worktree ".length));
}

function effectiveHooksPath(path) {
  try {
    return execFileSync("git", ["-C", path, "config", "--get", "core.hooksPath"], {
      encoding: "utf8",
    }).trim();
  } catch {
    // Unset everywhere in the chain, so git falls back to its own default.
    return ".git/hooks";
  }
}

const overridden = [];
const missing = [];
for (const path of worktreePaths()) {
  let actual;
  try {
    actual = effectiveHooksPath(path);
  } catch {
    continue; // Pruned or unreadable; not this script's problem to report.
  }

  if (actual !== TARGET) {
    overridden.push([path, actual]);
    continue;
  }

  // Resolving to the right path is worth nothing if the path is not there.
  // core.hooksPath is repo-wide but scripts/hooks is per-branch, so pointing
  // a checkout at it whose branch predates it silently disables every hook —
  // strictly worse than before this script ran, and completely silent. Found
  // by running this on a repo whose main checkout sat on such a branch.
  if (!existsSync(join(path, TARGET))) missing.push(path);
}

if (overridden.length === 0 && missing.length === 0) {
  console.log(`  Verified: ${TARGET} is in effect and present in every worktree.`);
  process.exit(0);
}

console.error(`
✗ The tracked hooks will NOT run in ${overridden.length + missing.length} of the repo's working trees.
`);

if (overridden.length > 0) {
  const width = Math.max(...overridden.map(([p]) => p.length));
  console.error(`  Overriding core.hooksPath in their own config.worktree, which beats
  the repo-level value:
`);
  for (const [path, actual] of overridden) {
    console.error(`    ${path.padEnd(width)}  ->  ${actual}`);
  }
  console.error(`
  Not changed automatically: that file belongs to whoever is working there,
  and one agent silently rewriting another's git config is the same class of
  surprise this script exists to remove. To adopt the tracked hooks, run
  inside the worktree:

    git config --unset core.hooksPath
`);
}

if (missing.length > 0) {
  console.error(`  Checked out on a branch with no ${TARGET} directory, so they now
  point at nothing and run no hooks at all:
`);
  for (const path of missing) console.error(`    ${path}`);
  console.error(`
  This is the dangerous one: it is strictly worse than before this script
  ran, and entirely silent. Either merge or rebase those branches onto one
  that carries ${TARGET}, or undo the setting until they catch up:

    git config --unset core.hooksPath
`);
}

console.error(`  Reporting success here while these trees commit unchecked is the failure
  being removed, so this exits non-zero.
`);
process.exit(1);
