/**
 * Refuses commits made from the main checkout.
 *
 * Git already guarantees that one branch cannot be checked out in two
 * worktrees at once:
 *
 *   fatal: 'my-branch' is already used by worktree at '/path/to/repo'
 *
 * That guarantee is free, permanent, and enforced by git rather than by
 * anyone remembering. It has exactly one blind spot: the main checkout, of
 * which there is only one, so two agents working there share a branch *and* a
 * working tree. Uncommitted edits become shared mutable state, and `git add`
 * in one session sweeps up another session's half-finished work. That is not
 * hypothetical — commit b800aa5 committed four files belonging to a different
 * session, which happened to be finished, purely by luck.
 *
 * So this does not invent a lock. It closes the blind spot, and lets git's own
 * invariant do the work: every agent in its own worktree means every agent on
 * its own branch, necessarily.
 *
 * Deliberate integration work in the main checkout — merges, release commits,
 * anything that is *supposed* to span branches — sets TAG_INTEGRATION=1. It
 * has to be typed, so it cannot be tripped by accident, which is the whole
 * difference between this and a warning.
 */
import { execSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { basename, resolve } from "node:path";

function git(args) {
  return execSync(`git ${args}`, { stdio: ["ignore", "pipe", "pipe"] })
    .toString()
    .trim();
}

/** Absolute and symlink-resolved, or the comparisons below are meaningless. */
function real(path) {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

/**
 * The common git dir, absolute.
 *
 * `rev-parse --git-common-dir` answers relative to the top level in the main
 * checkout (a bare ".git") and absolute in a linked worktree. Comparing the
 * two forms directly is a check that silently never fires, so resolve first.
 */
function commonGitDir() {
  return real(resolve(git("rev-parse --show-toplevel"), git("rev-parse --git-common-dir")));
}

/**
 * A linked worktree keeps its own git dir under the common one; the main
 * checkout's two are the same directory. Comparing them is the only check
 * that does not depend on directory naming or on where the repo lives.
 */
export function isMainCheckout() {
  return real(git("rev-parse --absolute-git-dir")) === commonGitDir();
}

/** Worktrees other than the main checkout, as absolute paths. */
export function linkedWorktrees() {
  const root = real(commonGitDir().replace(/\/\.git$/, ""));
  return git("worktree list --porcelain")
    .split("\n")
    .filter((l) => l.startsWith("worktree "))
    .map((l) => real(l.slice("worktree ".length)))
    .filter((p) => p !== root);
}

function main() {
  if (!isMainCheckout()) return;

  if (process.env.TAG_INTEGRATION === "1") {
    console.log("[agent-isolation] TAG_INTEGRATION=1 — allowing this main-checkout commit.");
    return;
  }

  let branch = "(detached)";
  try {
    branch = git("rev-parse --abbrev-ref HEAD");
  } catch {
    /* detached HEAD is fine; the message does not depend on it */
  }

  const others = linkedWorktrees();
  const suggested = `agent-${basename(process.cwd())}-${branch}`.replace(/[^A-Za-z0-9._-]+/g, "-");

  console.error(`
[agent-isolation] Refusing to commit from the main checkout.

  branch:   ${branch}
  live worktrees: ${others.length}

Two sessions in the main checkout share one branch AND one working tree, so
uncommitted edits are shared mutable state and one session can commit
another's unfinished work. Git prevents this everywhere else by refusing to
check out one branch in two worktrees — the main checkout is the one place
that guarantee cannot reach.

Work from a worktree instead, and git enforces one-branch-per-agent for you:

  git worktree add .claude/worktrees/${suggested} -b ${suggested}

If this commit is deliberate integration work that is supposed to span
branches — a merge, a release commit — say so explicitly:

  TAG_INTEGRATION=1 git commit ...
`);
  process.exit(1);
}

main();
