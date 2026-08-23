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
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { compareStory } from "./lib/story-regression.mjs";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function stagedStories() {
  return git(["diff", "--cached", "--name-only", "--diff-filter=ACM"])
    .split("\n")
    .filter((p) => /^docs\/stories\/.+\.md$/.test(p));
}

/** The committed version, or null if the file is new. */
function committed(path) {
  try {
    return git(["show", `HEAD:${path}`]);
  } catch {
    return null;
  }
}

if (process.env.TAG_STORY_REOPEN_OK === "1") {
  console.log("check-story-regression: skipped, TAG_STORY_REOPEN_OK=1");
  process.exit(0);
}

const stories = stagedStories();
if (stories.length === 0) process.exit(0);

const problems = [];
for (const path of stories) {
  const before = committed(path);
  if (before === null) continue;
  const after = readFileSync(path, "utf8");
  const { ok, findings } = compareStory(before, after);
  if (!ok) problems.push({ path, findings });
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
