#!/usr/bin/env node
/**
 * Every story file must have a row in an epic table.
 *
 * This is the defect that produced the duplicate 10.9. A story file exists,
 * has no row in `docs/epics.md`, so every reader who consults the table --
 * including every renumbering pass -- sees its number as free and mints
 * something else onto it. 10.9-user-menu-and-sign-out.md existed with no row,
 * production-hardening was renumbered onto 10.9, and it cost a morning.
 *
 * `check-story-status.mjs` refuses two stories sharing a number. It cannot
 * catch this, because an orphan story shares its number with nothing until
 * the moment someone duplicates it. The table is the index everyone reads,
 * and an absent row is invisible in exactly the way a duplicate is not.
 *
 * Found 2026-08-26: 14.B-inline-role-string-audit.md had been on main with no
 * table row, on six refs, unnoticed.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const EPICS = "docs/epics.md";
const STORIES = "docs/stories";

const epics = readFileSync(EPICS, "utf8");
const orphans = [];

for (const file of readdirSync(STORIES).sort()) {
  if (!file.endsWith(".md")) continue;
  const id = file.match(/^(\d+\.[0-9A-Za-z]+)/)?.[1];
  if (!id) continue;
  // A row is `| 14.B | title | status |`. Match the cell, not the bare string:
  // prose mentioning a story elsewhere in the doc is not an index entry.
  const row = new RegExp(`^\\|\\s*${id.replace(".", "\\.")}\\s*\\|`, "m");
  if (!row.test(epics)) orphans.push({ id, file });
}

if (orphans.length === 0) {
  console.log(`✓ Story index: every story in ${STORIES} has a row in ${EPICS}`);
  process.exit(0);
}

console.error(`\n✗ ${orphans.length} story file(s) with no row in ${EPICS}:\n`);
for (const { id, file } of orphans) {
  console.error(`    ${id}  ${join(STORIES, file)}`);
}
console.error(`
An orphan story's number reads as free to anyone consulting the table, which
is how 10.9 got duplicated. Add the row to its epic's table, or delete the
story file if it is dead. Do not renumber the story to fit the table.
`);
process.exit(1);
