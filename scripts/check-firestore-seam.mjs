#!/usr/bin/env node
/**
 * Refuses a commit that reaches past the repository seam (story 14.1).
 *
 * Firestore is reachable from exactly one module,
 * lib/data/firestore-repository.ts. Everything in lib/ and app/ goes through
 * the Repository interface, so 14.2 onward can swap the backing store without
 * touching a call site.
 *
 * WHY THIS EXISTS ALONGSIDE THE ESLINT RULE. eslint.config.mjs carries the same
 * restriction and states it better, with a message explaining what to do
 * instead. But the root `npm run lint` is not part of pre-commit — only the
 * Angular gate is, and only when web/ is touched. So the ESLint rule is a gate
 * you have to remember to run, and this is the one that runs itself.
 *
 * Deliberately a grep over STAGED files rather than a lint run: it has to be
 * fast enough that nobody wants it removed. A check people bypass for slowness
 * protects nothing.
 *
 * Escape hatch is typed, not remembered:
 *   TAG_SEAM_OK=1 git commit ...
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

if (process.env.TAG_SEAM_OK === "1") {
  console.log("check-firestore-seam: skipped, TAG_SEAM_OK=1");
  process.exit(0);
}

/** The implementation itself, and the module it wraps. */
const ALLOWED = [/^lib\/data\//, /^lib\/firestore\.ts$/];

/**
 * Matches an import of the client or the SDK, in any of the forms that reach
 * it: a bare import, a re-export (which is an import), and a relative path.
 * A re-export is the form the one real bypass took — lib/ghl/store.ts exported
 * the handle, so fifteen importers could have taken it without naming
 * lib/firestore themselves.
 */
const FORBIDDEN =
  /(?:import|export)[\s\S]{0,200}?from\s*["'](?:@\/lib\/firestore|@google-cloud\/firestore|(?:\.\.?\/)+lib\/firestore)["']/;

function staged() {
  return execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACM"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter((p) => /^(lib|app)\/.+\.tsx?$/.test(p))
    .filter((p) => !/\.test\.tsx?$/.test(p))
    .filter((p) => !ALLOWED.some((re) => re.test(p)));
}

const offenders = staged().filter((p) => existsSync(p) && FORBIDDEN.test(readFileSync(p, "utf8")));

if (offenders.length === 0) process.exit(0);

console.error("");
console.error("❌ Something is reaching past the repository seam.");
console.error("");
for (const file of offenders) console.error(`  ${file}`);
console.error("");
console.error("  Firestore is reachable only from lib/data/firestore-repository.ts.");
console.error("  Use `repository()` from @/lib/data instead.");
console.error("");
console.error("  If the operation you need is missing, ADD IT to the Repository");
console.error("  interface rather than reaching past it. That interface is what");
console.error("  story 14.2 implements a second time over Postgres, so an operation");
console.error("  that bypasses it is one that does not get migrated.");
console.error("");
console.error("  See docs/repository.md.");
console.error("");
process.exit(1);
