#!/usr/bin/env node
// Flags docs/stories/*.md whose Status field disagrees with their own Tasks checklist,
// and (when run pre-commit) whose referenced files were just touched without a status update.
// Exit 1 blocks the commit; this is a doc/code sync check, not a test runner.

import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const STORIES_DIR = "docs/stories";
const repoRoot = execSync("git rev-parse --show-toplevel").toString().trim();
const storiesPath = join(repoRoot, STORIES_DIR);

function stagedFiles() {
  try {
    return execSync("git diff --cached --name-only", { cwd: repoRoot })
      .toString()
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

function parseStory(file) {
  const text = readFileSync(file, "utf8");
  const statusMatch = text.match(/\*\*Status:\*\*\s*(.+)/i);
  const status = statusMatch ? statusMatch[1].trim() : null;
  const tasks = [...text.matchAll(/^- \[( |x)\]/gim)];
  const checked = tasks.filter((t) => t[1].toLowerCase() === "x").length;
  const total = tasks.length;
  // Files referenced in backticks anywhere in the doc (Tasks/Dev notes), e.g. `lib/foo/bar.ts`
  const referenced = [...text.matchAll(/`([\w./-]+\.(?:ts|tsx))`/g)].map((m) => m[1]);
  return { file, status, checked, total, referenced };
}

const files = readdirSync(storiesPath)
  .filter((f) => f.endsWith(".md"))
  .map((f) => join(storiesPath, f));

const staged = stagedFiles();
const problems = [];

for (const f of files) {
  const s = parseStory(f);
  const rel = f.replace(repoRoot + "/", "");

  if (s.status && /^done$/i.test(s.status) && s.total > 0 && s.checked < s.total) {
    problems.push(
      `${rel}: Status is "Done" but ${s.total - s.checked}/${s.total} tasks are unchecked.`
    );
  }

  if (s.status && /^(ready|in progress)$/i.test(s.status) && s.total > 0 && s.checked === s.total) {
    problems.push(
      `${rel}: all ${s.total} tasks are checked but Status is still "${s.status}". Flip it to Done or Review if the work actually landed.`
    );
  }

  // Pre-commit mode: this story's own referenced files are in the staged diff, but the
  // story doc itself was NOT staged, which likely means a status update was skipped.
  if (staged.length > 0) {
    const touchesReferenced = s.referenced.some((ref) => staged.some((sf) => sf.endsWith(ref)));
    const docStaged = staged.includes(rel);
    if (touchesReferenced && !docStaged && s.status && !/^done$/i.test(s.status)) {
      problems.push(
        `${rel}: this commit touches files this story references, but the doc (Status: "${s.status}") isn't part of the commit. Update Status/Tasks if this lands the story.`
      );
    }
  }
}

// Additional checks: architecture constraints, data model sync, role strings, seed script guards.
function checkArchitectureConstraints() {
  const constraintIssues = [];

  // Check 1: inline role literals (not via a ROLES.*/isRole/hasAnyRole helper from lib/auth/roles.ts).
  // Scoped per staged file (not the whole commit's diff text) so an exemption in one file can't
  // paper over a violation in an unrelated one, and the canonical definition files are excluded
  // since role strings are expected to live there.
  const ROLE_DEFINITION_FILES = ["lib/auth/roles.ts", "lib/auth/role-labels.ts"];
  const ROLE_STRING_PATTERN = /["'](tag_admin|tag_exec|tag_csd|admin|cse|cso|client_owner|closer|csm|executive|onboarding|tag_ops)["']/g;
  const ROLE_HELPER_PATTERN = /\bROLES\.|\bisRole\(|\bhasAnyRole\(|\beffectiveRole\(|from\s+["'][^"']*auth\/roles["']/;

  for (const file of staged) {
    if (!/\.(ts|tsx)$/.test(file) || ROLE_DEFINITION_FILES.includes(file)) continue;
    let fileDiff;
    try {
      fileDiff = execSync(`git diff --cached -U0 -- ${JSON.stringify(file)}`, { cwd: repoRoot }).toString();
    } catch {
      continue;
    }
    const roleStrings = fileDiff.match(ROLE_STRING_PATTERN) || [];
    if (roleStrings.length === 0) continue;
    // The helper/import may live on an unchanged line (e.g. an existing `import type { Role }`
    // above a newly-edited literal array below it), which a -U0 diff won't show. Fall back to
    // the file's full current content before flagging.
    let fullContent = "";
    try {
      fullContent = readFileSync(join(repoRoot, file), "utf8");
    } catch {
      // Deleted file; the diff-only check result stands.
    }
    if (roleStrings.length > 0 && !ROLE_HELPER_PATTERN.test(fileDiff) && !ROLE_HELPER_PATTERN.test(fullContent)) {
      for (const match of roleStrings) {
        constraintIssues.push(
          `${file}: inline role string ${match} found. Use ROLES.*/isRole/hasAnyRole from lib/auth/roles.ts instead.`
        );
      }
    }
  }

  // Check 2: cross-integration imports in staged code. Scoped to files actually under
  // `from`, and the alternation is grouped — an ungrouped `a|b` regex matches `b` bare
  // anywhere in the diff, not just after `from "..."`, which false-positives on any
  // staged file that merely mentions one of the `to` paths in a comment, string, or route.
  const crossIntegrationPatterns = [
    { from: "app/ghl/", to: ["app/meta/", "app/dashboard/"] },
    { from: "app/meta/", to: ["app/ghl/", "app/dashboard/"] },
    { from: "app/dashboard/", to: ["functions/"] },
  ];
  for (const pattern of crossIntegrationPatterns) {
    const sourceFiles = staged.filter((f) => f.startsWith(pattern.from) && /\.(ts|tsx)$/.test(f));
    const toAlternation = pattern.to.map((p) => p.replace(/[/.]/g, "\\$&")).join("|");
    const importRegex = new RegExp(`from\\s+["'](?:${toAlternation})`);
    for (const file of sourceFiles) {
      let fileDiff;
      try {
        fileDiff = execSync(`git diff --cached -U0 -- ${JSON.stringify(file)}`, { cwd: repoRoot }).toString();
      } catch {
        continue;
      }
      if (importRegex.test(fileDiff)) {
        constraintIssues.push(
          `${file}: cross-integration import from ${pattern.to.join(" or ")}. Each integration is isolated; use API endpoints instead.`
        );
      }
    }
  }

  // Check 3: data model changes without docs update
  const dataModelFilePatterns = [
    "lib/firestore.ts",
    "lib/postgres.ts",
    "functions/sql/",
    "app/actions.ts",
  ];
  const touchesDataModel = staged.some((file) =>
    dataModelFilePatterns.some((pattern) => file.includes(pattern))
  );
  if (touchesDataModel && !staged.includes("docs/data-model.md")) {
    constraintIssues.push(
      "This commit touches data model files but docs/data-model.md is not staged. Update the data model documentation in the same commit."
    );
  }

  // Check 4: seed scripts must check NODE_ENV and GCP project
  const seedScriptsEdited = staged.filter((f) => f.match(/scripts\/setup.*\.(ts|mjs)$/));
  for (const script of seedScriptsEdited) {
    try {
      const scriptContent = readFileSync(join(repoRoot, script), "utf8");
      // The shared guard in lib/seed-guard.ts checks both, and checking both
      // in one place is the point. A script that calls it satisfies the rule
      // without having to repeat the literals inline — otherwise this check
      // pushes every seed script back to its own copy of the guard, which is
      // how two of them ended up with no guard at all.
      const usesSharedGuard = /assertSafeToSeed\s*\(/.test(scriptContent);
      const hasNodeEnvCheck = /NODE_ENV|process\.env\.NODE_ENV/.test(scriptContent);
      const hasProjectCheck = /GOOGLE_CLOUD_PROJECT|process\.env\.GOOGLE_CLOUD_PROJECT/.test(scriptContent);
      if (!usesSharedGuard && (!hasNodeEnvCheck || !hasProjectCheck)) {
        constraintIssues.push(
          `${script}: seed scripts must call assertSafeToSeed() from lib/seed-guard.ts, or check NODE_ENV and GOOGLE_CLOUD_PROJECT inline, before any .set() writes.`
        );
      }
    } catch {
      // File being deleted or not readable; skip
    }
  }

  return constraintIssues;
}

const archIssues = checkArchitectureConstraints();
problems.push(...archIssues);

if (problems.length) {
  console.error("\n❌ Pre-commit checks failed:\n");
  for (const p of problems) console.error("  - " + p);
  console.error("\nFix the issues and commit again.");
  console.error("Bypass (not recommended): git commit --no-verify\n");
  process.exit(1);
}
