#!/usr/bin/env node
/**
 * Repo hygiene: the shape of the tree, judged by exit code rather than by
 * whoever happens to look.
 *
 * WHY THIS EXISTS. `.DS_Store` sat tracked on `main` for weeks while
 * `.gitignore` ignored it. Nobody was careless: hygiene was the one property
 * here with no durable owner. Every other rule in this repo is enforced by a
 * script, and rules that are not degrade across session replacement — which
 * this fleet does hourly. A standard nobody can fail is not a standard.
 *
 * WHAT IT DOES NOT DO. It makes no aesthetic judgement. It will not tell you a
 * README is thin or a directory badly named, because a guard that argues about
 * taste is one people learn to disable. Both rules below are mechanical and
 * have zero-tolerance for false positives:
 *
 *   1. TRACKED-BUT-IGNORED. A file that is committed and that `.gitignore`
 *      would ignore. This is never intentional. It means the file was
 *      committed before the ignore rule existed, and it stays forever because
 *      `.gitignore` does not apply to already-tracked paths — the single most
 *      common way a repo accumulates junk nobody can see.
 *
 *   2. ROOT ALLOWLIST. Top-level entries must be declared below. The root is
 *      the first thing any reader sees, and it is where stray files land
 *      because there is nowhere obvious to put them. Adding an entry is one
 *      line and is meant to be a decision, not an accident.
 *
 * A DELIBERATE OMISSION. An earlier draft had a third rule flagging a
 * directory holding a single file while a sibling held the rest, aimed at
 * `sql/flow-schema.sql` against eleven migrations in `functions/sql/`. It was
 * dropped: the rule is a heuristic, and a heuristic in a blocking guard
 * produces false positives, and a guard with false positives gets bypassed
 * and then bypassed for the real thing. That singleton is a judgement call for
 * a human, once.
 */
import { execFileSync } from "node:child_process";

/**
 * Every entry permitted at the repository root.
 *
 * Adding a line here is the point of the rule, not a way around it: a new
 * top-level entry should be a decision someone made on purpose and can defend
 * in review, rather than a file that appeared because it had nowhere else to
 * go. Remove a line when the entry goes.
 *
 * THE ONE WAY TO MAKE THIS GUARD GREEN ON A TREE THAT SHOULD FAIL: stage a
 * stray root file and add its name to this list in the same commit. Exit 0, and
 * nothing here or in CI notices that the declaration grew in the same diff as
 * the thing it permits. That is how the rule quietly becomes "whatever the tree
 * already is".
 *
 * It is deliberately not mechanised. A rule cannot tell a legitimate new root
 * entry from an illegitimate one — that is the judgement the allowlist exists to
 * force. **So it is a review-surface problem, and this paragraph is the fix: a
 * commit that both adds a root entry and adds its allowlist line is the thing a
 * reviewer must look at, and now it has a name.**
 */
const ROOT_ALLOWLIST = new Set([
  // Agent and tooling configuration
  ".claude", ".githooks", ".github", "_bmad",
  // Ignore and environment declarations
  ".dockerignore", ".env.example", ".gcloudignore", ".gitignore", ".nvmrc",
  // Instructions, read by humans and agents both
  "AGENTS.md", "CLAUDE.md", "README.md",
  // Build, deploy and language configuration
  "Dockerfile", "cloudbuild.yaml", "eslint.config.mjs", "next.config.ts",
  "package.json", "package-lock.json", "postcss.config.mjs", "proxy.ts",
  "tsconfig.json", "vitest.config.mts",
  // Design tokens, consumed by both frontends
  "design-tokens.css", "design-tokens.json",
  // Source trees
  "app", "functions", "legacy", "lib", "public", "scripts", "sql", "test", "web",
  // Documentation and retained material
  "docs", "reference", "_archive",
  // Client material with no better home yet
  "TAG_Client_Onboarding_Canvas.md",
]);

/**
 * Resolve the working tree's top level once, and run every git call there.
 *
 * `execFileSync` inherits the process cwd, and `git ls-files` reports only paths
 * beneath it — so invoking this script from `docs/` reported the contents of
 * `docs/` as undeclared *root* entries: a confident, specific, entirely
 * fabricated failure list. Neither real invocation path hits it (git runs hooks
 * at the top level, and Actions runs steps at the repo root), but a session
 * running the script by hand while diagnosing something does, and that is the
 * worst moment to be lied to.
 */
let TOP;
try {
  TOP = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch {
  // Run outside a repository this used to die with git's fatal plus twenty
  // lines of Node stack. It failed closed, so CI was never at risk — but a
  // guard whose whole argument is that its output is trustworthy at the worst
  // moment should not answer with a stack trace.
  console.error("✗ Repo hygiene: not inside a git repository, so there is nothing to check.");
  console.error("  Run this from anywhere inside the working tree.");
  process.exit(1);
}

// `core.quotepath=false` so a non-ASCII path prints as its name rather than as
// escaped octal. The rule was already correct on those paths; the report was
// unreadable at exactly the moment someone needed to read it.
const git = (...args) =>
  execFileSync("git", ["-c", "core.quotepath=false", ...args], { cwd: TOP, encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);

/**
 * `ls-files -z`, split on NUL.
 *
 * Without this, a path containing a newline is C-quoted by git — the guard hands
 * `check-ignore` the literal `"we\nird.ts"`, which matches no path, and the file
 * is reported as "an unreadable source". `core.quotepath=false` does not help:
 * it governs non-ASCII bytes, not control characters. Absurd input, real
 * behaviour, and the old output told the reader nothing.
 */
const gitZ = (...args) =>
  execFileSync("git", ["-c", "core.quotepath=false", ...args, "-z"], {
    cwd: TOP,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);

const failures = [];

// --- Rule 1: tracked, and ignored by committed repo state ------------------
// The invariant this rule needs is "ignored by rules that are IN the repository".
// Two attempts to get there by enumerating ignore sources both failed, and the
// second failed in a way that would have deleted someone's work:
//
//   `--exclude-standard` reads .gitignore, the untracked .git/info/exclude, AND
//   the committer's global core.excludesFile. Machine-local rules became repo
//   rules for one person: red on their laptop, green in CI.
//
//   `--exclude-per-directory=.gitignore` with core.excludesFile=/dev/null closed
//   those, and reintroduced the same defect through the working tree — it does
//   not care whether a .gitignore is committed. An UNTRACKED `feat/.gitignore`,
//   or a tracked `.gitignore` with uncommitted edits, both produce hits that
//   exist on exactly one machine. Reproduced; see story 22.1.
//
// So stop enumerating sources and ATTRIBUTE each hit instead. `check-ignore -v`
// names the file and line that did the ignoring; a hit counts only if that file
// is itself tracked and unmodified — i.e. every other clone has the same rule.
// This is source-agnostic by construction: a source nobody has thought of still
// has to be committed to count, so the enumeration cannot be incomplete again.
const candidates = gitZ("ls-files", "--cached", "--ignored", "--exclude-standard");

// Paths whose ignore rule is not committed repo state. Reported separately,
// because the remediation is the opposite one: fix your local setup, never
// `git rm --cached` a file the repository has no opinion about.
const localOnly = [];
const committedIgnored = [];

for (const path of candidates) {
  // `check-ignore -v --no-index` prints `<source>:<line>:<pattern>\t<path>`.
  // `--no-index` is REQUIRED: check-ignore skips tracked paths by default, and
  // every path here is tracked by definition, so without it the command exits 1
  // on all of them and the catch below silently reclassified every real hit as
  // "unreadable". Found by testing a tracked nested .gitignore that should have
  // been a committed hit and came back local-only.
  let source = "";
  try {
    source = git("check-ignore", "-v", "--no-index", "--", path)[0]?.split(":")[0] ?? "";
  } catch {
    source = "";
  }
  const insideRepo = source && !source.startsWith("/") && !source.includes(".git/info/");
  const tracked =
    insideRepo &&
    (() => {
      try {
        git("ls-files", "--error-unmatch", "--", source);
        return true;
      } catch {
        return false;
      }
    })();
  // A tracked-but-modified source is not repo state either: the rule that fired
  // is the one on this disk, not the one everyone else has.
  //
  // `status --porcelain` REPORTS THE INDEX COLUMN AS WELL AS THE WORKTREE ONE,
  // and that is load-bearing. A source staged with content differing from HEAD
  // shows as `M ` — M in column 1, space in column 2 — so it is caught. **Do not
  // swap this for `git diff --quiet`**, which compares worktree against index
  // only: that case would silently start producing `git rm --cached` advice on a
  // source that is not committed yet, which is the exact defect two rewrites of
  // this rule already had.
  const dirty = tracked && git("status", "--porcelain", "--", source).length > 0;

  if (tracked && !dirty) committedIgnored.push(`${path}  (ignored by ${source})`);
  else localOnly.push(`${path}  (ignored by ${source || "an unreadable source"})`);
}

if (committedIgnored.length > 0) {
  failures.push({
    rule: "tracked but ignored",
    items: committedIgnored,
    why:
      "Committed AND ignored by a committed .gitignore, so every clone agrees.\n" +
      "  .gitignore does not apply to paths already in the index, so this never\n" +
      "  resolves on its own. Untrack with:\n" +
      "    git rm --cached <path>",
  });
}

if (localOnly.length > 0) {
  failures.push({
    rule: "ignored only on this machine",
    items: localOnly,
    why:
      "These are ignored by a rule that is NOT committed — an untracked or\n" +
      "  uncommitted .gitignore, .git/info/exclude, or a global excludesFile. The\n" +
      "  repository has no opinion about them and other clones see nothing.\n" +
      "  DO NOT run `git rm --cached` here: it would untrack a file the repo\n" +
      "  legitimately holds. Fix the local ignore rule, or commit it if it is real.\n" +
      "\n" +
      "  THEN RE-RUN THIS CHECK. Only the highest-precedence match is reported, and\n" +
      "  a deeper .gitignore outranks a shallower one — so an uncommitted rule can\n" +
      "  mask a genuine committed one underneath it. A path listed here may ALSO be\n" +
      "  ignored by committed state, and that finding only surfaces once the local\n" +
      "  rule is gone.",
  });
}

// --- Rule 2: root allowlist -------------------------------------------------
// Read the INDEX, not HEAD. `git ls-tree HEAD` is the last commit, so a newly
// staged root file is invisible to it until after it has landed — a guard that
// cannot see the change it is meant to refuse. Caught by planting a staged root
// file and watching this rule stay green, which is the only reason it is not
// still wrong. `ls-files` lists index paths, so the first segment of each is a
// top-level entry, staged additions included.
const rootEntries = [...new Set(gitZ("ls-files").map((p) => p.split("/")[0]))];
const undeclared = rootEntries.filter((e) => !ROOT_ALLOWLIST.has(e));
if (undeclared.length > 0) {
  failures.push({
    rule: "undeclared top-level entry",
    items: undeclared,
    why:
      "The repository root is the first thing a reader sees. If this entry belongs\n" +
      "  here, add it to ROOT_ALLOWLIST in this script and say why in the commit.\n" +
      "  If it does not, move it under docs/, reference/ or the tree that owns it.",
  });
}

if (failures.length === 0) {
  console.log("✓ Repo hygiene: nothing tracked-but-ignored, no undeclared root entries");
  process.exit(0);
}

console.error("");
for (const f of failures) {
  console.error(`✗ ${f.items.length} ${f.rule}:`);
  console.error("");
  for (const i of f.items) console.error(`    ${i}`);
  console.error("");
  console.error(`  ${f.why}`);
  console.error("");
}
process.exit(1);
