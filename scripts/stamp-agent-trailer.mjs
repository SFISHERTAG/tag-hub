/**
 * Stamps each commit with the worktree it came from.
 *
 * Eight commits landed on onboarding-intake-wizard-scaffold in 28 minutes,
 * every one of them authored "Leverage Architect", from several different
 * agent sessions. Nothing in `git log` could say which session made which, so
 * a collision could not even be diagnosed after the fact, let alone traced.
 *
 * The worktree name is the session's identity, because check-agent-isolation
 * guarantees one worktree per session and git guarantees one branch per
 * worktree. Set AGENT_ID to override it with something more meaningful.
 *
 * Usage: prepare-commit-msg hook — argv[2] is the message file, argv[3] the
 * source ("message", "merge", "squash", "commit" for --amend, or absent for a
 * plain interactive commit).
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const TRAILER = "Agent-Worktree";

/**
 * Who PERFORMED a merge, which is a different fact from who authored the
 * content and is the one that matters on main.
 *
 * Added 2026-08-23 after a monitoring session flagged main moving and
 * attributed it to Sam. It was not Sam; every session in this repo commits as
 * the same git author, so authorship cannot distinguish them. Ordinary commits
 * carry Agent-Worktree and merges carried nothing, which meant the highest
 * stakes commits in the repo were the only ones with no attribution at all.
 *
 * Deliberately NOT Agent-Worktree. Stamping that on a merge would claim
 * authorship of the merged branch's work, which is the reason merges were
 * skipped in the first place and that reason still holds.
 */
const MERGE_TRAILER = "Merged-By-Worktree";

function git(args) {
  return execSync(`git ${args}`, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
}

function agentId() {
  if (process.env.AGENT_ID) return process.env.AGENT_ID;
  const gitDir = git("rev-parse --absolute-git-dir");
  // Linked worktrees live at <common>/worktrees/<name>; the main checkout does not.
  const m = gitDir.match(/\/worktrees\/([^/]+)$/);
  return m ? m[1] : "main-checkout";
}

/** Records the worktree that performed a merge. Never claims authorship. */
function stampMerge(messageFile) {
  const message = readFileSync(messageFile, "utf8");
  if (new RegExp(`^${MERGE_TRAILER}:`, "m").test(message)) return;
  const body = message.replace(/\s*$/, "");
  const separator = /\n[A-Za-z-]+:[^\n]*$/.test(body) ? "\n" : "\n\n";
  writeFileSync(messageFile, `${body}${separator}${MERGE_TRAILER}: ${worktree()}\n`);
}

function main() {
  const [messageFile, source] = process.argv.slice(2);
  if (!messageFile) return;

  // A merge or squash message is assembled by git from other commits, and an
  // amend already carries whatever trailer the original had. Stamping those
  // either duplicates an existing trailer or attributes someone else's work.
  //
  // A merge still gets a MERGE trailer, because "who merged this into main" is
  // a separate question from "who wrote it" and is the one nobody could answer.
  if (source === "merge") return stampMerge(messageFile);
  if (source === "squash" || source === "commit") return;

  const message = readFileSync(messageFile, "utf8");
  if (new RegExp(`^${TRAILER}:`, "m").test(message)) return;

  const body = message.replace(/\s*$/, "");
  // Trailers belong in one block at the end. If the message already ends with
  // trailers (Co-Authored-By and friends), join that block rather than
  // starting a second one separated by a blank line.
  //
  // A trailer block is only a trailer block if something precedes it. Without
  // that check, a subject line is itself "Word: text" often enough — every
  // conventional commit, "probe: ...", "Story 7.4: ..." — that the trailer
  // gets glued onto the subject and swallowed by `git log --oneline`.
  const blocks = body.split("\n\n");
  const lastBlock = blocks[blocks.length - 1] ?? "";
  const endsWithTrailers =
    blocks.length > 1 &&
    lastBlock.length > 0 &&
    lastBlock.split("\n").every((l) => /^[A-Za-z-]+:\s/.test(l));

  writeFileSync(messageFile, `${body}${endsWithTrailers ? "\n" : "\n\n"}${TRAILER}: ${agentId()}\n`);
}

main();
