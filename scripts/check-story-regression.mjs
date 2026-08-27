#!/usr/bin/env node
/**
 * Refuses a commit that walks a story document backwards.
 *
 * Companion to check-story-status.mjs, which reads one version of a story and
 * asks whether it is self-consistent. This reads two and asks whether the change
 * between them was intended. Both are needed: on 2026-08-23 a commit reverted
 * five completed checkboxes and deleted a Dev Agent Record, and
 * check-story-status passed it, correctly — the result was perfectly
 * self-consistent. It was just wrong.
 *
 * Compares the staged story against the committed one. Deliberate reopenings
 * are legitimate and this must not block them, so:
 *
 *   TAG_STORY_REOPEN_OK=1 git commit ...
 *
 * Mid-merge, "the committed one" is not HEAD alone. HEAD is the pre-merge tip,
 * so on a branch catching up, every deliberate correction main has made since
 * the branch was cut reads here as that branch going backwards. It refused
 * fix/alert-on-config-fault's catch-up on 2026-08-27 over
 * docs/stories/4.4-roas-joined-on-utmadid.md, whose Status main had corrected
 * from "done" to "ready" precisely because it was not done. The correction was
 * right, the branch was stale, and the message printed below told it to run the
 * merge this check was refusing.
 *
 * So on a merge a finding only counts if it holds against BOTH parents. Content
 * taken verbatim from the other side is that side's decision, already reviewed
 * where it landed, and not something this commit invented. A resolution that
 * produces a regression present on neither parent is still refused.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { compareStory } from "./lib/story-regression.mjs";

function git(args, { quiet = false } = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    // A new story has no committed version, and `git show` says so on stderr.
    // That is the expected path, not a problem, so it must not print "fatal:"
    // into hook output — output nobody reads is a gate nobody checks.
    stdio: quiet ? ["ignore", "pipe", "ignore"] : undefined,
  });
}

function stagedStories() {
  return git(["diff", "--cached", "--name-only", "--diff-filter=ACM"])
    .split("\n")
    .filter((p) => /^docs\/stories\/.+\.md$/.test(p));
}

/** The version at a ref, or null if the file does not exist there. */
function versionAt(ref, path) {
  try {
    return git(["show", `${ref}:${path}`], { quiet: true });
  } catch {
    return null;
  }
}

/**
 * The commit being merged in, or null when this is not a merge.
 *
 * Two hooks reach this file and they see different things, which the first
 * version of this fix got wrong.
 *
 * `pre-commit` runs when a merge has STOPPED, on a conflict or because another
 * hook refused, and is then concluded with `git commit`. MERGE_HEAD exists by
 * then, so the first probe answers.
 *
 * `pre-merge-commit` runs on a CLEAN merge, and git writes MERGE_HEAD only when
 * a merge stops. So the first probe returns null exactly where this check runs
 * first, and the original fix was inert there: a clean catch-up was refused,
 * the refusal itself left MERGE_HEAD behind, and the retry through `git commit`
 * then passed. Two commands and a false refusal for what should be one command.
 * Confirmed on git 2.50.1 with a hook that reports only whether MERGE_HEAD
 * exists.
 *
 * What git does export there is `GITHEAD_<sha>=<ref>`, one per commit being
 * merged, with the sha in the variable NAME rather than its value.
 *
 * More than one means an octopus merge. Taking an arbitrary parent from that
 * set would be worse than not answering, so this returns null and an octopus
 * falls back to the single-parent comparison. That is the strict direction: it
 * can refuse a merge it should allow, never the reverse.
 */
function mergeHead() {
  try {
    const fromRef = git(["rev-parse", "--verify", "--quiet", "MERGE_HEAD"], { quiet: true }).trim();
    if (fromRef) return fromRef;
  } catch {
    // Not a stopped merge. Fall through to the pre-merge-commit signal.
  }

  // {40,64} rather than {40}: this repo is sha1 today (`git rev-parse
  // --show-object-format`), but on a sha256 repo a {40} pattern matches nothing,
  // `heads` comes back empty, and the guard silently reverts to single-parent.
  // That fails strict rather than lenient, so nothing is wrongly permitted, but
  // it fails SILENTLY, which is the property that has cost this repo the most.
  const heads = Object.keys(process.env).filter((k) => /^GITHEAD_[0-9a-f]{40,64}$/.test(k));
  return heads.length === 1 ? heads[0].slice("GITHEAD_".length) : null;
}

if (process.env.TAG_STORY_REOPEN_OK === "1") {
  console.log("check-story-regression: skipped, TAG_STORY_REOPEN_OK=1");
  process.exit(0);
}

const stories = stagedStories();
if (stories.length === 0) process.exit(0);

const other = mergeHead();
const parents = other ? ["HEAD", other] : ["HEAD"];

const problems = [];
for (const path of stories) {
  const after = readFileSync(path, "utf8");
  const results = parents
    .map((ref) => versionAt(ref, path))
    .filter((before) => before !== null)
    .map((before) => compareStory(before, after));

  // New on every parent: nothing to walk backwards from.
  if (results.length === 0) continue;
  // Clean against at least one parent, so this content exists on a side that
  // was reviewed where it landed. Only the resolution's own inventions remain.
  if (results.some((r) => r.ok)) continue;

  problems.push({ path, findings: results[0].findings });
}

if (problems.length === 0) process.exit(0);

console.error("");
console.error("❌ A story document is going backwards.");
console.error("");
for (const { path, findings } of problems) {
  console.error(`  ${path}`);
  for (const f of findings) console.error(`    - ${f}`);
  console.error("");
}
console.error("  This is almost always an edit made against an older copy of the file:");
console.error("  the intended change lands, and completed work is silently reverted");
console.error("  alongside it. That is exactly how story 10.3 lost its record on");
console.error("  2026-08-23, and how a requirement rejected with reasons was reopened");
console.error("  an hour later.");
console.error("");
console.error("  Catch the branch up first:  git fetch origin && git merge origin/main");
console.error("");
console.error("  If the reopening IS deliberate — new scope on a finished story, work");
console.error("  genuinely undone — say so, and keep the Dev Agent Record explaining why:");
console.error("");
console.error("    TAG_STORY_REOPEN_OK=1 git commit ...");
console.error("");
process.exit(1);
