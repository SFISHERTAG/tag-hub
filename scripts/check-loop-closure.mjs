/**
 * Reports every open loop in this repo: work that was started and never
 * merged, deleted, pushed, or declared dead.
 *
 * Why this exists. The other checks in scripts/ all guard the moment a change
 * enters the tree — is the story status honest, is the branch fresh, is a role
 * string inlined. Nothing guarded the moment a piece of work *stops*. With one
 * branch and one worktree per session, that gap compounds fast: 73 local
 * branches against 27 on the remote, 30 of them ahead of main, five named
 * worktree-agent-<hash> and untouched for a week. Each one individually was a
 * reasonable thing to create. Collectively they made "what is the state of
 * this repo" unanswerable without reading transcripts.
 *
 * The answer to that question kept getting written into dated status docs
 * instead — MERGE_STATUS_2026-08-23-FINAL.md next to -UPDATED.md, both
 * untracked, both wrong by the next morning. A generated report cannot go
 * stale and never acquires a "-FINAL" sibling, so this replaces them.
 *
 * Deliberately advisory. It prints and exits 0 by default: a check that blocks
 * a commit because of some *other* branch's age teaches people to bypass the
 * hook, and taking that habit into check-story-status or check-secret-scan
 * would cost far more than the mess this cleans up. Pass --strict (or set
 * TAG_LOOPS_STRICT=1) to exit non-zero when anything is stale — that is the
 * form for CI or a session-close gate, where failing is the point.
 *
 * Everything here is read from refs and worktree state. Nothing is inferred
 * from a doc, a memory file, or a transcript, because those are what proved
 * unreliable. Read-only: this reports, it never moves a ref.
 */
import { execSync } from "node:child_process";

const STALE_DAYS = Number(process.env.TAG_LOOP_STALE_DAYS ?? 3);
const BASE = process.env.TAG_BASE_REF ?? "origin/main";
const STRICT = process.argv.includes("--strict") || process.env.TAG_LOOPS_STRICT === "1";

// Branch-name prefixes that declare an intent, so the report can say what a
// branch is FOR rather than only how old it is. `keep/` is the escape hatch:
// it means "open on purpose, stop asking".
const DECLARED = ["keep/", "hold/", "main"];

function git(args, cwd) {
  try {
    return execSync(`git ${args}`, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

const days = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

function branches() {
  const raw = git(
    "for-each-ref --format='%(refname:short)\t%(committerdate:iso8601)\t%(upstream:short)' refs/heads",
  );
  if (!raw) return [];

  return raw
    .split("\n")
    .map((line) => line.replace(/^'|'$/g, ""))
    .filter(Boolean)
    .map((line) => {
      const [name, date, upstream] = line.split("\t");
      // A branch with no unique commits is not an open loop — it is a label on
      // work that already landed, and reporting it as unfinished would bury the
      // branches that genuinely hold something.
      const ahead = Number(git(`rev-list --count --no-merges ${BASE}..${name}`) ?? 0);
      return { name, age: days(date), upstream: upstream || null, ahead };
    });
}

function worktrees() {
  const raw = git("worktree list --porcelain");
  if (!raw) return [];

  return raw
    .split("\n\n")
    .map((block) => {
      const path = block.match(/^worktree (.+)$/m)?.[1];
      if (!path) return null;
      // A worktree whose git dir has gone away (a scratch dir that was cleaned
      // up, a /tmp path the OS reaped) is a stale registration, not a loop.
      if (git("rev-parse --git-dir", path) === null) return { path, gone: true };
      const branch = block.match(/^branch refs\/heads\/(.+)$/m)?.[1] ?? null;
      const dirty = (git("status --porcelain", path) ?? "").split("\n").filter(Boolean).length;
      return { path, branch, dirty, detached: branch === null, gone: false };
    })
    .filter(Boolean);
}

// Names a real branch containing the worktree's HEAD, or null if the commit
// lives on no branch at all — the only case where a detached worktree is
// actually at risk of losing work.
function containingBranch(path) {
  // Format string stays quoted: bare parentheses are shell syntax, and an
  // unquoted %(refname:short) fails silently into the null branch below.
  const raw = git("branch --contains HEAD --format='%(refname:short)'", path);
  if (!raw) return null;
  return raw.split("\n").map((l) => l.trim()).map((l) => l.replace(/^'|'$/g, ""))
    .filter((l) => l && !l.startsWith("("))[0] ?? null;
}

function main() {
  if (git(`rev-parse --verify --quiet ${BASE}`) === null) {
    console.log(`[loops] no ${BASE} to compare against — skipping.`);
    return;
  }

  const all = branches();
  const open = all.filter(
    (b) => b.ahead > 0 && !DECLARED.some((p) => b.name === p || b.name.startsWith(p)),
  );
  const stale = open.filter((b) => b.age > STALE_DAYS);
  const unpushed = open.filter((b) => b.upstream === null);
  const trees = worktrees();
  const detached = trees.filter((w) => w.detached && !w.gone);
  const dirty = trees.filter((w) => w.dirty > 0);
  const gone = trees.filter((w) => w.gone);

  console.log(`\n  OPEN LOOPS  (against ${BASE}, stale after ${STALE_DAYS}d)\n`);
  console.log(`  ${String(open.length).padStart(3)}  branches with unmerged work`);
  console.log(`  ${String(stale.length).padStart(3)}  of those untouched for more than ${STALE_DAYS} days`);
  console.log(`  ${String(unpushed.length).padStart(3)}  of those existing only on this machine`);
  console.log(`  ${String(detached.length).padStart(3)}  worktrees on a detached HEAD`);
  console.log(`  ${String(dirty.length).padStart(3)}  worktrees with uncommitted files`);
  if (gone.length) console.log(`  ${String(gone.length).padStart(3)}  worktree registrations whose directory is gone`);

  if (stale.length) {
    console.log(`\n  Stale, oldest first — merge it, delete it, or rename it keep/<reason>:\n`);
    for (const b of [...stale].sort((a, z) => z.age - a.age)) {
      const flag = b.upstream ? "        " : "  local ";
      console.log(`  ${String(b.age).padStart(3)}d${flag}${b.name}  (+${b.ahead})`);
    }
  }

  for (const w of detached) {
    // The first line back is git's own "(HEAD detached at <sha>)" pseudo-entry,
    // not a branch. Taking it verbatim reported rescued work as stranded.
    const on = containingBranch(w.path);
    console.log(
      `\n  detached: ${w.path}` +
        (on ? `\n            its commit is on ${on} — safe, just unnamed here` : `\n            its commit is on NO branch — name it before anything else`),
    );
  }

  for (const w of dirty) {
    console.log(`\n  dirty:    ${w.path}  (${w.dirty} file${w.dirty === 1 ? "" : "s"} on ${w.branch ?? "detached HEAD"})`);
  }

  if (!stale.length && !detached.length && !dirty.length) {
    console.log(`\n  Nothing stale. Every open branch is younger than ${STALE_DAYS} days.`);
  }
  console.log("");

  if (STRICT && (stale.length || detached.some((w) => containingBranch(w.path) === null))) {
    console.error("[loops] --strict: close these or rename them keep/<reason> before finishing.\n");
    process.exit(1);
  }
}

main();
