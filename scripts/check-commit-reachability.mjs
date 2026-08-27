/**
 * Refuses a commit that lands somewhere nobody can find it.
 *
 * Every other guard here asks whether a commit is *correct*. This one asks a
 * cheaper question that had no guard at all: after this commit exists, is there
 * any name that reaches it, and does that name exist anywhere but this machine?
 *
 * Two conditions, and only the first refuses:
 *
 *   1. Detached HEAD — REFUSE. A commit on a detached HEAD has no branch
 *      pointing at it. It survives until something moves HEAD, then it is
 *      reachable only through the reflog, and `git worktree prune` or a gc past
 *      the expiry takes it for good. There is no undo to ship for this one,
 *      which is why it refuses rather than warns.
 *
 *   2. Branch with no upstream — WARN. A brand-new branch legitimately has no
 *      remote yet, so refusing would block the first commit of every branch
 *      anyone ever starts. But work that exists in exactly one place is one
 *      disk failure or one bad checkout from being gone, so it says so, every
 *      time, with the exact command that fixes it.
 *
 * The scar: on 2026-08-26 a session's worktree was left on a detached HEAD
 * carrying 42 commits, on a branch that had never been pushed. Both conditions
 * at once. The work was found and backed up by accident, during an unrelated
 * audit, and nothing in the repo would have reported it. `check-loop-closure`
 * does print detached worktrees, but only when someone runs it, and only after
 * the commits already exist. This runs before.
 *
 * Deliberately not covered: a commit on a named local branch that is behind or
 * diverged from its upstream. That is `check-branch-freshness`, which refuses
 * on drift, and doubling it up here would produce two different messages for
 * one condition.
 *
 * Note that `check-branch-freshness` returns early when the branch reads as
 * "HEAD", which is exactly the detached case — it exempts it rather than
 * catching it. That exemption is correct for what that check measures (a
 * detached HEAD has no branch to be stale) and is the reason this gap existed.
 *
 * Escape hatch is typed, not remembered: TAG_DETACHED_OK=1 git commit ...
 * Legitimate uses: reproducing an old bug, bisecting, a deliberate throwaway.
 */
import { execSync } from "node:child_process";

function tryGit(args) {
  try {
    return execSync(`git ${args}`, { stdio: ["ignore", "pipe", "pipe"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function main() {
  // `--abbrev-ref HEAD` returns the literal string "HEAD" when detached. That
  // is the whole detection: there is no branch name to return.
  const branch = tryGit("rev-parse --abbrev-ref HEAD");

  // No HEAD at all is the very first commit in a fresh repo. Nothing to check,
  // and inventing a failure there would block `git init` + first commit.
  if (branch === null) return;

  if (branch !== "HEAD") {
    // Named branch. The only remaining question is whether it exists anywhere
    // else. `@{upstream}` fails loudly when there is no tracking ref, which is
    // the signal we want.
    if (tryGit("rev-parse --abbrev-ref --symbolic-full-name @{upstream}") === null) {
      console.warn(
        `\n[reachability] ${branch} exists only on this machine.\n\n` +
          `  This commit will be reachable from nowhere else until you push.\n` +
          `  Push at birth, not at completion:\n\n` +
          `    git push -u origin ${branch}\n`,
      );
    }
    return;
  }

  if (process.env.TAG_DETACHED_OK === "1") {
    const at = tryGit("rev-parse --short HEAD") ?? "unknown";
    console.log(`[reachability] TAG_DETACHED_OK=1 — allowing a detached commit at ${at}.`);
    return;
  }

  const at = tryGit("rev-parse --short HEAD") ?? "unknown";
  // Name a branch that already contains HEAD, if one does. When the worktree
  // was merely parked on a commit that some branch still points at, the fix is
  // a checkout rather than a new branch, and saying so avoids creating a
  // duplicate branch for work that was never actually stranded.
  // The format string stays quoted. These commands run through a shell, and
  // bare parentheses in %(refname:short) are shell syntax: unquoted, the call
  // throws, tryGit returns null, and this silently degrades to "on no branch
  // at all" — telling you to create a branch for work that was never actually
  // stranded. check-loop-closure.mjs carries the same warning, and this check
  // shipped with the bug anyway until a planted test caught it.
  const contains = (tryGit("branch --contains HEAD --format='%(refname:short)'") ?? "")
    .split("\n")
    .map((l) => l.trim().replace(/^'|'$/g, ""))
    .filter((l) => l && !l.startsWith("("))[0];

  console.error(`
[reachability] Refusing to commit on a detached HEAD (at ${at}).

  A commit made here has no branch pointing at it. Nothing in the repo will
  list it, no other session can see it, and once HEAD moves it is reachable
  only through the reflog until that expires.

${
  contains
    ? `  HEAD is already on ${contains}. You almost certainly want:\n\n    git checkout ${contains}\n`
    : `  HEAD is on no branch at all. Name it before you commit:\n\n    git switch -c <branch-name>\n    git push -u origin HEAD\n`
}
  If this is deliberate — bisecting, reproducing an old bug, a throwaway:

    TAG_DETACHED_OK=1 git commit ...
`);
  process.exit(1);
}

main();
