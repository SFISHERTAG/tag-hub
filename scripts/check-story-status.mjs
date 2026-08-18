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
  // Files this story actually owns are the ones listed on its own Tasks
  // checklist lines, e.g. `- [ ] lib/foo/bar.ts`. Scoping to task lines
  // (rather than every backtick-quoted path anywhere in the doc) avoids
  // flagging incidental mentions elsewhere - e.g. Acceptance Criteria prose
  // that cites another story's file as background context isn't a claim
  // that *this* story tracks that file.
  const referenced = text
    .split("\n")
    .filter((line) => /^- \[( |x)\]/i.test(line))
    .flatMap((line) => [...line.matchAll(/`([\w./-]+\.(?:ts|tsx))`/g)].map((m) => m[1]));
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
  const stageContent = execSync("git diff --cached -U0", { cwd: repoRoot }).toString();

  // Check 1: inline role literals (not via ROLES.* constant)
  const roleStrings = stageContent.match(/["'](tag_admin|tag_exec|tag_csd|admin|cse|cso|client_owner|closer|csm|executive|onboarding|tag_ops)["']/g) || [];
  for (const match of roleStrings) {
    if (!stageContent.includes("ROLES.") && !stageContent.includes("import.*ROLES")) {
      constraintIssues.push(
        `Inline role string ${match} found. Use ROLES.* from lib/auth/roles.ts instead.`
      );
    }
  }

  // Check 2: cross-integration imports in staged code
  const crossIntegrationPatterns = [
    { from: "app/ghl/", to: ["app/meta/", "app/dashboard/"] },
    { from: "app/meta/", to: ["app/ghl/", "app/dashboard/"] },
    { from: "app/dashboard/", to: ["functions/"] },
  ];
  for (const pattern of crossIntegrationPatterns) {
    // The alternation must stay inside a non-capturing group: without it,
    // `|` splits the whole pattern in two, so every alternative after the
    // first drops the `from\s+["']` prefix and matches its bare path
    // anywhere in the diff, including inside this very array of literal
    // path strings.
    const regex = new RegExp(`from\\s+["'](?:${pattern.to.join("|")})`, "g");
    const matches = stageContent.match(regex) || [];
    if (matches.length > 0) {
      constraintIssues.push(
        `Cross-integration import detected in ${pattern.from}. Each integration is isolated; use API endpoints instead.`
      );
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
      const hasNodeEnvCheck = /NODE_ENV|process\.env\.NODE_ENV/.test(scriptContent);
      const hasProjectCheck = /GOOGLE_CLOUD_PROJECT|process\.env\.GOOGLE_CLOUD_PROJECT/.test(scriptContent);
      if (!hasNodeEnvCheck || !hasProjectCheck) {
        constraintIssues.push(
          `${script}: seed scripts must check NODE_ENV and GOOGLE_CLOUD_PROJECT before any .set() writes.`
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
