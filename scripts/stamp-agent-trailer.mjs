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

function main() {
  const [messageFile, source] = process.argv.slice(2);
  if (!messageFile) return;

  // A merge or squash message is assembled by git from other commits, and an
  // amend already carries whatever trailer the original had. Stamping those
  // either duplicates an existing trailer or attributes someone else's work.
  if (source === "merge" || source === "squash" || source === "commit") return;

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
