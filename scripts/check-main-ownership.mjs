#!/usr/bin/env node
/**
 * Refuses to let a session commit onto, merge into, or push `main` unless it
 * is the session that owns `main`.
 *
 * Why this exists. Several Claude sessions share one `.git`. On 2026-08-23 a
 * session merged a feature branch into `main` and pushed it while another was
 * mid-story against the previous tip. Nothing was corrupted — the two changes
 * did not overlap — but the second session had verified against a commit that
 * was no longer `main`, which is the failure `docs/AGENT_COORDINATION.md` §2
 * calls a green check from the wrong branch.
 *
 * Why it is not a pre-commit check alone. `git merge` does not run
 * `pre-commit`. A guard installed only there would not have stopped the exact
 * event that prompted it. So this runs from three hooks:
 *
 *   pre-commit         ordinary commits made while on main
 *   pre-merge-commit   merges made while on main   <- the one that matters
 *   pre-push           pushes of refs/heads/main from anywhere
 *
 * Ownership is a typed environment variable, not a name or a lock file:
 *
 *   TAG_MAIN_OWNER=1 git merge --no-ff claude/some-branch
 *   TAG_MAIN_OWNER=1 git push origin main
 *
 * Typed each time, on purpose. A persisted marker gets set once and then
 * outlives the intent, which is how you end up with a guard that is on paper
 * only. If you are typing it and you are not the owning session, that is the
 * moment to stop and ask instead.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PROTECTED = process.env.TAG_PROTECTED_BRANCH ?? "main";
const mode = process.argv.includes("--mode=push") ? "push" : "local";

if (process.env.TAG_MAIN_OWNER === "1") process.exit(0);

function refuse(what) {
  console.error("");
  console.error(`❌ ${what}`);
  console.error("");
  console.error(`   \`${PROTECTED}\` is owned by one session at a time. Several Claude`);
  console.error("   sessions share this .git, and a moving base turns another");
  console.error("   session's verified commit into a stale one.");
  console.error("");
  console.error("   If you own it, say so explicitly:");
  console.error("");
  console.error(`     TAG_MAIN_OWNER=1 ${mode === "push" ? "git push ..." : "git commit ..."}`);
  console.error("");
  console.error("   If you do not, work on your own branch and ask the owning");
  console.error(`   session to land it. See docs/AGENT_COORDINATION.md §9.`);
  console.error("");
  process.exit(1);
}

if (mode === "local") {
  let branch = "";
  try {
    branch = execSync("git rev-parse --abbrev-ref HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    process.exit(0); // No HEAD yet. Nothing to protect.
  }
  if (branch === PROTECTED) {
    refuse(`Refusing to write to \`${PROTECTED}\` from this session.`);
  }
  process.exit(0);
}

// Push mode. git feeds "<localref> <localsha> <remoteref> <remotesha>" on stdin.
let stdin = "";
try {
  stdin = readFileSync(0, "utf8");
} catch {
  process.exit(0);
}

for (const line of stdin.split("\n")) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 3) continue;
  const remoteRef = parts[2];
  if (remoteRef === `refs/heads/${PROTECTED}`) {
    refuse(`Refusing to push \`${PROTECTED}\` from this session.`);
  }
}

process.exit(0);
