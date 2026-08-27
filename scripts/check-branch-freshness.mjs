/**
 * Refuses commits on a branch that has drifted too far behind origin/main.
 *
 * The manifest check in .githooks/pre-commit catches a tree that contradicts
 * its own config — package.json naming a check script that is not there. It
 * cannot catch the case that actually happened here: a branch that is simply
 * old, and internally consistent about being old. Every check it declares is
 * present and passes, so nothing complains, while the checks main has added
 * since are absent and therefore never run. The branch reports healthy by
 * running a smaller and smaller share of the gates.
 *
 * That is how a checkout sat 31 commits behind main for two weeks with two of
 * three hooks inert and 22 test files missing, and looked fine throughout.
 *
 * Two conditions fail here, for different reasons:
 *
 *   1. No unique work + behind. The branch is a stale snapshot, not work in
 *      progress. There is nothing on it to protect, so committing onto it
 *      only deepens the drift. This is the exact shape of the stranding.
 *   2. Behind by more than MAX_BEHIND. Work in progress is fine, but past
 *      some distance the branch is no longer running the same gates as main
 *      and its green result stops meaning anything.
 *
 * Compares against the local origin/main ref and does not fetch: a pre-commit
 * hook that reaches the network is a hook people disable. A stale ref only
 * makes this check more lenient, never falsely strict.
 *
 * Escape hatch is typed, not remembered: TAG_STALE_OK=1 git commit ...
 */
import { execSync } from "node:child_process";

const MAX_BEHIND = Number(process.env.TAG_MAX_BEHIND ?? 20);
const BASE = process.env.TAG_BASE_REF ?? "origin/main";

function git(args) {
  return execSync(`git ${args}`, { stdio: ["ignore", "pipe", "pipe"] })
    .toString()
    .trim();
}

function tryGit(args) {
  try {
    return git(args);
  } catch {
    return null;
  }
}

function main() {
  // No base ref (fresh clone, no remote, offline-only repo) — nothing to
  // compare against, and inventing a failure here would block real work.
  if (tryGit(`rev-parse --verify --quiet ${BASE}`) === null) return;

  const branch = tryGit("rev-parse --abbrev-ref HEAD");
  if (!branch || branch === "main" || branch === "HEAD") return;

  if (process.env.TAG_STALE_OK === "1") {
    console.log(`[branch-freshness] TAG_STALE_OK=1 — allowing a commit on ${branch}.`);
    return;
  }

  // Mid-merge, HEAD is still the pre-merge commit, so counting from it measures
  // the drift this very commit is erasing. Measure what the merge actually
  // leaves instead: commits in BASE that the merge result would still not
  // reach. Zero means this commit IS the catch-up printed at the bottom of this
  // file as the remedy.
  //
  // How a catch-up reaches a pre-commit hook at all: git runs pre-merge-commit
  // for a merge, and that hook does not call this check. But it calls others,
  // and any one of them refusing leaves the merge in progress with MERGE_HEAD
  // set, so the only way to conclude it is `git commit`, which runs pre-commit,
  // which runs this. Conflicts do the same thing by a different road. Neither is
  // the trigger; MERGE_HEAD is. An earlier draft of this comment said a clean
  // merge never arrives here, and the Reviewer reproduced a clean one that did.
  // On 2026-08-27 the pair of them deadlocked fix/alert-on-config-fault, 25
  // behind, unable to run the merge both guards printed as the remedy.
  //
  // Existence of MERGE_HEAD alone is not the test. Returning on that would wave
  // through a merge of any unrelated branch while the drift stands untouched.
  const mergeHead = tryGit("rev-parse --verify --quiet MERGE_HEAD");
  const behind = mergeHead
    ? Number(tryGit(`rev-list --count ${BASE} --not HEAD MERGE_HEAD`) ?? 0)
    : Number(tryGit(`rev-list --count HEAD..${BASE}`) ?? 0);
  if (behind === 0) return;

  // Merge commits are excluded: merging main in does not make a branch your
  // own work, and counting them would let a stale snapshot look productive.
  //
  // This one is deliberately NOT adjusted for a merge in progress. A branch with
  // no work of its own that is mid-merge of something other than BASE is still
  // stranded, and should still be refused.
  const unique = Number(tryGit(`rev-list --count --no-merges ${BASE}..HEAD`) ?? 0);

  const stranded = unique === 0;
  if (!stranded && behind <= MAX_BEHIND) return;

  const reason = stranded
    ? `it has no commits of its own — every change on it is already in ${BASE}`
    : `it is ${behind} commits behind ${BASE} (limit ${MAX_BEHIND})`;

  console.error(`
[branch-freshness] Refusing to commit on ${branch}.

  behind ${BASE}: ${behind}
  its own commits: ${unique}

This branch is stale: ${reason}.

A stale branch does not fail loudly, it fails quietly — it runs only the gates
that existed when it was cut, and reports green while the checks main added
since never run at all. ${stranded ? "There is no work on this branch to protect." : ""}

  ${stranded ? `Switch to main:            git checkout main` : `Catch the branch up:       git merge ${BASE}`}

If this is deliberate — reproducing an old bug, backporting a fix — say so:

  TAG_STALE_OK=1 git commit ...
`);
  process.exit(1);
}

main();
