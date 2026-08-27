#!/usr/bin/env node
/**
 * Prints what is waiting on a human, and what is not.
 *
 * The problem this solves is not "which PRs are open". `gh pr list` answers
 * that and it is the wrong question, because it mixes three states a person
 * has to act on differently:
 *
 *   - waiting on a DECISION      nothing moves until a human says yes
 *   - waiting on a MACHINE       CI is running, or GitHub has not computed
 *                                mergeability; asking again in a minute is the
 *                                whole action
 *   - waiting on WORK            conflicting, failing, or draft; a session has
 *                                something to do before a human is involved
 *
 * On 2026-08-27 ten PRs sat open with all four checks green for hours, and the
 * blocker was that nobody could see, at a glance, which of them were actually
 * asking a question. Sessions merged eight of them in twenty minutes once the
 * question was legible.
 *
 * Status is generated, never written. This exists for the same reason
 * check-loop-closure does, and reads from `gh` alone rather than from any
 * document.
 */
import { execFileSync } from "node:child_process";

function gh(args) {
  try {
    return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return null;
  }
}

const raw = gh([
  "pr", "list", "--json",
  "number,title,mergeable,mergeStateStatus,isDraft,statusCheckRollup,headRefName",
]);

if (raw === null) {
  console.error("\n  [awaiting-human] `gh pr list` failed. Not the same as zero open PRs.\n");
  process.exit(2);
}

const prs = JSON.parse(raw);

// A check with no conclusion yet is pending, which is a machine state and not a
// failure. Conflating the two is how "0 failing" gets read as "ready".
const checkState = (pr) => {
  const rollup = pr.statusCheckRollup ?? [];
  if (rollup.length === 0) return "none";
  if (rollup.some((c) => (c.conclusion ?? c.state) === "FAILURE")) return "failing";
  if (rollup.some((c) => !c.conclusion && c.state !== "SUCCESS")) return "pending";
  return rollup.every((c) => (c.conclusion ?? c.state) === "SUCCESS") ? "green" : "pending";
};

const bucket = (pr) => {
  if (pr.isDraft) return "work";
  if (pr.mergeable === "CONFLICTING") return "work";
  const checks = checkState(pr);
  if (checks === "failing") return "work";
  if (checks === "pending") return "machine";
  // UNKNOWN means GitHub has not finished computing it, which it does lazily
  // after main moves. Asking again is the action, so it is not a decision.
  if (pr.mergeable === "UNKNOWN") return "machine";
  return "decision";
};

const why = (pr) => {
  if (pr.isDraft) return "draft";
  if (pr.mergeable === "CONFLICTING") return "conflicting, needs a rebase or a catch-up merge";
  const checks = checkState(pr);
  if (checks === "failing") return "a check is failing";
  if (checks === "pending") return "CI still running";
  if (pr.mergeable === "UNKNOWN") return "GitHub has not computed mergeability yet, re-run this";
  return "green and mergeable";
};

const groups = { decision: [], machine: [], work: [] };
for (const pr of prs) groups[bucket(pr)].push(pr);

const heading = (title, list) => {
  console.log(`\n  ${title}  (${list.length})\n`);
  if (list.length === 0) {
    console.log("    nothing\n");
    return;
  }
  for (const pr of list) {
    console.log(`    #${String(pr.number).padEnd(4)} ${pr.title.slice(0, 60)}`);
    console.log(`          ${why(pr)}`);
  }
  console.log("");
};

console.log("\n  AWAITING A HUMAN  (generated from gh, not from any document)");
heading("YOUR CALL — green, mergeable, nothing moves without a yes", groups.decision);
heading("WAITING ON A MACHINE — no action, ask again shortly", groups.machine);
heading("WAITING ON WORK — a session has something to do first", groups.work);
console.log(
  `  ${groups.decision.length} of ${prs.length} open PRs are actually asking you a question.\n`,
);
