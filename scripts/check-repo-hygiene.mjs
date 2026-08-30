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

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8" }).trim().split("\n").filter(Boolean);

const failures = [];

// --- Rule 1: tracked but ignored -------------------------------------------
// `--cached --ignored --exclude-standard` lists exactly the paths that are in
// the index AND matched by an ignore rule. It cannot report a file that is
// merely untracked, so a hit here is always a real one.
const trackedIgnored = git("ls-files", "--cached", "--ignored", "--exclude-standard");
if (trackedIgnored.length > 0) {
  failures.push({
    rule: "tracked but ignored",
    items: trackedIgnored,
    why:
      "These are committed AND matched by .gitignore. .gitignore does not apply to\n" +
      "  paths already in the index, so this never resolves on its own. Untrack with:\n" +
      "    git rm --cached <path>",
  });
}

// --- Rule 2: root allowlist -------------------------------------------------
// Read the INDEX, not HEAD. `git ls-tree HEAD` is the last commit, so a newly
// staged root file is invisible to it until after it has landed — a guard that
// cannot see the change it is meant to refuse. Caught by planting a staged root
// file and watching this rule stay green, which is the only reason it is not
// still wrong. `ls-files` lists index paths, so the first segment of each is a
// top-level entry, staged additions included.
const rootEntries = [...new Set(git("ls-files").map((p) => p.split("/")[0]))];
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
