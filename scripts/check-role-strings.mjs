#!/usr/bin/env node
/**
 * Refuses a tree containing an inline role string.
 *
 * CLAUDE.md: no role string may appear in backend code, Angular components,
 * templates or route guards except via `ROLES.*` or a `PermissionService`
 * call. That constraint had two independent holes, both found on 2026-08-23
 * and both documented in docs/stories/14.B-inline-role-string-audit.md.
 *
 * HOLE 1, DIFF SCOPE. The inline-role check inside check-story-status.mjs
 * reads `git diff --cached --name-only`, so it only ever sees files in the
 * commit. Correct for a commit gate, and structurally unable to find a
 * violation already in the tree. Eight were.
 *
 * HOLE 2, FILE-LEVEL EXEMPTION. That check exempted a whole FILE if the file
 * matched a helper pattern anywhere in it. So `hasAnyRole(role, ["admin"])`
 * passed, because the call that makes it a violation is also the call that
 * exempted it. Five files were shielded that way.
 *
 * This scanner closes both: it reads the whole tree, and it exempts per LINE.
 * A line calling `ROLES.ADMIN` is fine. A line with a bare literal is not,
 * regardless of what the rest of the file does.
 *
 * The role list is parsed from lib/auth/role-labels.ts rather than hardcoded.
 * A hardcoded copy is how the original check drifted: it matched roles that no
 * longer existed and missed several that did.
 *
 * Escape hatch is typed, not remembered:
 *   TAG_ROLE_STRINGS_OK=1 git commit ...
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

if (process.env.TAG_ROLE_STRINGS_OK === "1") {
  console.log("check-role-strings: skipped, TAG_ROLE_STRINGS_OK=1");
  process.exit(0);
}

/** Where role strings are allowed to be written out, because they are defined there. */
const DEFINITION_FILES = new Set([
  "lib/auth/roles.ts",
  "lib/auth/role-labels.ts",
  "web/src/app/core/models/role.model.ts",
  // Cloud Functions cannot import lib/auth/roles.ts across the workspace
  // boundary; functions/src/auth.ts asserts every role it issues exists.
  "functions/src/auth.ts",
]);

/**
 * `legacy/**` is excluded: story 10.7 deletes the directory wholesale, and
 * 135 lines there are a triage problem rather than a regression. Tests are
 * excluded because a role literal in a routing assertion is describing
 * behaviour, not gating it.
 */
function inScope(path) {
  if (!/\.(ts|tsx)$/.test(path)) return false;
  if (path.startsWith("legacy/")) return false;
  if (/\.(test|spec)\.tsx?$/.test(path)) return false;
  if (DEFINITION_FILES.has(path)) return false;
  return /^(lib|app|scripts|functions\/src)\//.test(path);
}

function roleLiteralPattern() {
  const source = readFileSync("lib/auth/role-labels.ts", "utf8");
  const block = source.match(/export const ROLES = \{([\s\S]*?)\} as const/);
  if (!block) {
    throw new Error(
      "check-role-strings: could not parse ROLES from lib/auth/role-labels.ts. " +
        "If the shape changed, update this script — do not fall back to a hardcoded list.",
    );
  }
  const roles = [...block[1].matchAll(/:\s*["']([a-z_]+)["']/g)].map((m) => m[1]);
  if (roles.length === 0) throw new Error("check-role-strings: parsed zero roles.");
  return new RegExp(`["'](${roles.join("|")})["']`, "g");
}

/*
 * There is deliberately NO helper exemption here, at any granularity.
 *
 * The first version of this script carried one, per line rather than per file,
 * on the reasoning that a line calling a sanctioned helper is fine. Testing it
 * against a planted `hasAnyRole(r, ["admin"])` showed that line passing — which
 * is hole 2 exactly, reproduced inside the fix for hole 2, because the call
 * that makes it a violation is also the call that exempted it.
 *
 * The exemption was never needed. The pattern below matches QUOTED literals,
 * and `ROLES.ADMIN` has no quotes, so sanctioned usage cannot false-positive.
 * An exemption that cannot help and can only hide is not a trade-off.
 */

const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter(inScope);

const pattern = roleLiteralPattern();
const findings = [];

for (const file of files) {
  if (!existsSync(file)) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  let inBlockComment = false;
  lines.forEach((raw, index) => {
    const trimmed = raw.trim();
    if (inBlockComment) {
      if (trimmed.includes("*/")) inBlockComment = false;
      return;
    }
    if (trimmed.startsWith("/*")) {
      if (!trimmed.includes("*/")) inBlockComment = true;
      return;
    }
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
    const code = raw.replace(/\/\/.*$/, "");
    pattern.lastIndex = 0;
    const hits = [...code.matchAll(pattern)].map((m) => m[1]);
    if (hits.length > 0) {
      findings.push({ file, line: index + 1, hits, text: trimmed.slice(0, 100) });
    }
  });
}

if (findings.length === 0) process.exit(0);

const occurrences = findings.reduce((n, f) => n + f.hits.length, 0);
const fileCount = new Set(findings.map((f) => f.file)).size;

console.error("");
console.error("❌ Inline role strings found.");
console.error("");
console.error(`  ${fileCount} files, ${findings.length} lines, ${occurrences} occurrences.`);
console.error("  (Units stated separately on purpose — they are not interchangeable.)");
console.error("");
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}`);
  console.error(`      ${f.text}`);
}
console.error("");
console.error("  Use ROLES.* from lib/auth/roles.ts, or role-labels.ts in a");
console.error("  client-safe file — roles.ts is server-only.");
console.error("");
console.error("  Why this is enforced: CLAUDE.md names a \"tag_admin\" vs \"admin\"");
console.error("  mismatch as the failure this prevents. A typo in a claim-issuing");
console.error("  path writes a claim nothing grants against, and the user is");
console.error("  silently locked out rather than refused.");
console.error("");
process.exit(1);
