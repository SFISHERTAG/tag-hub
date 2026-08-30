#!/usr/bin/env node
/**
 * A story's row in `docs/epics.md` must agree with its own doc's Status field.
 *
 * The third guard in the family, and the gap between the other two:
 * `check-story-status.mjs` compares a doc against its own Tasks, and
 * `check-story-index.mjs` catches a story file with no row. Neither compares
 * the row to the doc, so a row can say `Draft` for a story whose doc says
 * `Review — implemented`, and nothing notices.
 *
 * Found 2026-08-28 by hand: ten rows disagreed with their own docs on `main`
 * at d014508. Nine ran one direction -- the table behind the doc, work done
 * and recorded as not started. The tenth, 4.4, said `Done` for a story whose
 * doc said `Ready — blocked on 4.2`, and 4.2 is itself blocked. That is the
 * direction that gets counted as shipped.
 *
 * ---------------------------------------------------------------------------
 * WHAT COUNTS AS A DISAGREEMENT, stated here rather than left to the regex.
 *
 * Only the leading status WORD is compared. Everything after the first `—`,
 * `-`, `.`, `(` or `,` is free commentary and is ignored, because that is
 * where every row records its dates, its caveats and its blockers. About
 * thirty rows differ in commentary alone -- `Done` against
 * `Done. Implemented 2026-08-25; corrected 2026-08-27` -- and not one of
 * those is a disagreement. Comparison is case-insensitive: the table writes
 * both `In Progress` and `In progress`.
 *
 * So `Draft` vs `Review — implemented 2026-08-23` fails, and
 * `Superseded by 13.5` vs `Superseded by 13.5 (2026-08-22)` passes.
 *
 * ---------------------------------------------------------------------------
 * WHY A CLOSED VOCABULARY, and what it refuses.
 *
 * A guard that classifies free prose is a guard built on sand: it cannot tell
 * a new status word from a typo, and a status no mechanism can read is the
 * condition that let all ten rows drift. So STATUSES below is closed, and a
 * status outside it is reported rather than guessed at.
 *
 * Measured at d014508 before choosing this: exactly three statuses in the
 * whole corpus fall outside the set. Two are table rows with no story doc
 * (7.1 `Shell built`, 8.2 `Partly rendered in 7.1`), which this guard never
 * compares and does not flag -- `check-story-index` owns rows without docs.
 * The third, 5.6's doc `Implemented, unit-tested`, does participate in a
 * comparison, and it is reported as unreadable rather than silently skipped.
 * An unreadable status is a failure, not an exemption: skipping it is how a
 * row opts out of the check by being written badly.
 *
 * Longest match wins, so `Not implemented` is not read as `Implemented`.
 *
 * ---------------------------------------------------------------------------
 * THE VOCABULARY IS READ FROM `docs/epics.md`, NOT KEPT HERE.
 *
 * That file declares the closed set in its `## Status vocabulary` table, and a
 * second copy in this script would be a second thing to drift. That is not a
 * hypothetical: on 2026-08-29 the declared list said `In review` where every
 * story doc says `Review`, and omitted four words nine stories were already
 * using. A guard carrying its own copy would have enforced the wrong list
 * confidently. FALLBACK below is used only when the section is absent, and the
 * guard says so when it falls back rather than pretending it read something.
 *
 * `Review` means the code is complete. It is NOT a claim that it has been run:
 * 11.6's backfill and 15.0's migration `011` are both `Review`, both written,
 * and both never executed. "Written and run against real data" is `Done`.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const EPICS = "docs/epics.md";
const STORIES = "docs/stories";

/** Used only when `docs/epics.md` declares no vocabulary section. */
const FALLBACK = [
  "Not implemented",
  "In Progress",
  "Superseded",
  "Backlog",
  "Blocked",
  "Retired",
  "Review",
  "Ready",
  "Draft",
  "Done",
];

/**
 * The declared vocabulary: the backticked word in each row of the
 * `## Status vocabulary` table. Returns null when that section is absent, so
 * the caller can say it fell back instead of silently using its own list.
 */
function declaredVocabulary(md) {
  const section = md.split(/^## /m).find((s) => s.startsWith("Status vocabulary"));
  if (!section) return null;
  const words = [...section.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((m) => m[1]);
  return words.length ? words : null;
}

/**
 * The leading status word, or null if it is not in the vocabulary.
 * Commentary after the first delimiter is dropped before matching, so the
 * date, the blocker and the caveat never reach the comparison.
 */
function statusWord(raw) {
  if (!raw) return null;
  const head = raw
    .replace(/[*`]/g, "")
    .split(/[—–\-.,(]/)[0]
    .trim()
    .toLowerCase();
  const hit = STATUSES.filter((s) => head.startsWith(s.toLowerCase())).sort(
    (a, b) => b.length - a.length,
  )[0];
  return hit ?? null;
}

/**
 * Table Status cells, keyed by story id.
 *
 * Column-driven, never positional. `docs/epics.md` carries twelve
 * three-column tables and five four-column ones, and a positional parser
 * reads the four-column tables' `Doc` cell as their Status -- which returns a
 * filename where a status belongs and compares cleanly against nothing. Each
 * header row resets the Status index for the rows beneath it.
 */
function tableStatuses(md) {
  const out = new Map();
  let statusCol = -1;
  for (const line of md.split("\n")) {
    if (!line.trimStart().startsWith("|")) {
      statusCol = -1;
      continue;
    }
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    const header = cells.findIndex((c) => c.toLowerCase() === "status");
    if (header !== -1) {
      statusCol = header;
      continue;
    }
    if (statusCol === -1) continue;
    const id = cells[0]?.match(/^(\d+\.[0-9A-Za-z]+)$/)?.[1];
    if (id) out.set(id, cells[statusCol] ?? "");
  }
  return out;
}

const epicsMd = readFileSync(EPICS, "utf8");
const declared = declaredVocabulary(epicsMd);
const STATUSES = declared ?? FALLBACK;
if (!declared) {
  console.error(
    `! ${EPICS} declares no "## Status vocabulary" section; using this script's fallback list.`,
  );
}

const table = tableStatuses(epicsMd);
const disagreements = [];
const unreadable = [];

for (const file of readdirSync(STORIES).sort()) {
  if (!file.endsWith(".md")) continue;
  const id = file.match(/^(\d+\.[0-9A-Za-z]+)/)?.[1];
  if (!id || !table.has(id)) continue; // rows without docs are check-story-index's job

  const rowRaw = table.get(id);
  const docRaw = readFileSync(join(STORIES, file), "utf8").match(
    /^\*\*Status:\*\*\s*(.+)$/m,
  )?.[1];

  const row = statusWord(rowRaw);
  const doc = statusWord(docRaw);

  if (row === null || doc === null) {
    unreadable.push({ id, file, rowRaw, docRaw, side: row === null ? "table" : "doc" });
    continue;
  }
  if (row !== doc) disagreements.push({ id, file, row, doc, rowRaw, docRaw });
}

const failures = disagreements.length + unreadable.length;
if (failures === 0) {
  console.log(`✓ Story status parity: every row in ${EPICS} agrees with its story doc`);
  process.exit(0);
}

if (disagreements.length) {
  console.error(`\n✗ ${disagreements.length} row(s) disagreeing with their own story doc:\n`);
  for (const d of disagreements) {
    console.error(`    ${d.id.padEnd(6)} table: ${d.row.padEnd(16)} doc: ${d.doc}`);
    console.error(`           ${EPICS}: ${d.rowRaw}`);
    console.error(`           ${join(STORIES, d.file)}: ${d.docRaw}\n`);
  }
}

if (unreadable.length) {
  console.error(`\n✗ ${unreadable.length} status outside the vocabulary, on the ${unreadable.map((u) => u.side).join("/")} side:\n`);
  for (const u of unreadable) {
    console.error(`    ${u.id.padEnd(6)} ${EPICS}: ${u.rowRaw}`);
    console.error(`           ${join(STORIES, u.file)}: ${u.docRaw}\n`);
  }
  console.error(`    Vocabulary: ${STATUSES.join(", ")}`);
}

console.error(`
A row and its doc are one record of one story. When they disagree the table is
what gets read, so the doc's truth is the one that goes missing. Fix whichever
is wrong -- not whichever is easier -- and if the doc is right, the row is the
one that moves.
`);
process.exit(1);
