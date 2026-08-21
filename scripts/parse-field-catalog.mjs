/**
 * Parses docs/client-fields.md into the field catalog.
 *
 * The doc is the source of truth (docs/client-fields.md, "Four structural
 * decisions"). Hand-transcribing a hundred rows x 7 roles is exactly the kind
 * of task where one mistyped dash silently grants a client TAG's margin — so
 * the table is parsed, never retyped, and test/field-catalog-drift.test.ts
 * re-parses it to fail CI if the generated file and the doc disagree.
 *
 * Column positions are read from each table's own header row rather than
 * assumed. They used to be a fixed offset, which worked for thirteen of the
 * fourteen tables and silently dropped all nine rows of the fourteenth, whose
 * header carries an extra `Definition` column. A row that looks like a field
 * row and does not parse is now a thrown error, not a `continue`: this file
 * feeds a visibility allowlist, where a quietly missing field is a blank
 * dashboard nobody can explain.
 */
import { readFileSync } from "node:fs";

/** @typedef {import("../lib/auth/roles").Role} Role */
/** @typedef {"on" | "available" | "never"} FieldVisibility */
/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   src: string,
 *   section: string | null,
 *   sectionNumber: string | null,
 *   now: "live" | "blocked",
 *   visibility: Record<string, FieldVisibility>,
 * }} ParsedField
 */

export const ROLE_COLUMNS = ["EX", "CS", "SM", "SL", "OW", "CM", "CL"];

/** @type {Record<string, Role>} */
export const ROLE_BY_COLUMN = {
  EX: "tag_exec",
  CS: "tag_csm",
  SM: "tag_sales_manager",
  SL: "tag_sales",
  OW: "client_owner",
  CM: "client_manager",
  CL: "client_closer",
};

/** @type {Record<string, FieldVisibility>} */
const MARK = { "●": "on", "○": "available", "—": "never", "-": "never" };

/** The NOW column: does this field have a live integration behind it today? */
const NOW_MARK = { "●": "live", "○": "blocked" };

/** Cells of a markdown table row, including the first. Null if not a table row. */
function rowCells(line) {
  const m = line.match(/^\|(.*)\|\s*$/);
  if (!m) return null;
  return m[1].split("|").map((c) => c.trim());
}

/** A `|---|---|` rule, which is what marks the line above it as a header. */
function isSeparator(line) {
  const cells = rowCells(line);
  return cells !== null && cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c));
}

/**
 * Column index of each role in this table, or null if this is not a field
 * table. Other tables in the doc also have backticked first cells (the file
 * map at the top, for one), so the header is what identifies a field table.
 */
function roleIndexFrom(headerCells) {
  if (headerCells[0] !== "ID") return null;
  /** @type {Record<string, number>} */
  const index = {};
  for (const col of ROLE_COLUMNS) {
    const at = headerCells.indexOf(col);
    if (at === -1) return null;
    index[col] = at;
  }
  index.Field = headerCells.indexOf("Field");
  index.SRC = headerCells.indexOf("SRC");
  index.NOW = headerCells.indexOf("NOW");
  if (index.Field === -1 || index.SRC === -1 || index.NOW === -1) return null;
  return index;
}

/**
 * The field count each numbered section declares in its own heading, e.g.
 * `## 8. Sales execution — the fractional team (9)`.
 *
 * This is the one number in the pipeline a human wrote and the parser did not
 * derive, which is exactly what makes it worth checking against. The drift
 * test compares the generated file to this parser's output, so it can only
 * ever catch a hand-edit or a stale regeneration — never a parse defect,
 * because both sides of that comparison come from the same code.
 *
 * @returns {Record<string, number>}
 */
export function declaredSectionCounts(path = "docs/client-fields.md") {
  const counts = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^##\s+\d+b?\.\s+(.+?)\s*\((\d+)\)\s*$/);
    if (m) counts[m[1].trim()] = Number(m[2]);
  }
  return counts;
}

/**
 * Throws if any section yielded a different number of fields than its heading
 * declares. Called by the generator before it writes and by the drift test,
 * so a silently lost row fails both.
 *
 * @param {ParsedField[]} fields
 */
export function assertSectionCounts(fields, path = "docs/client-fields.md") {
  const declared = declaredSectionCounts(path);
  /** @type {Record<string, number>} */
  const parsed = {};
  for (const f of fields) {
    if (f.section) parsed[f.section] = (parsed[f.section] ?? 0) + 1;
  }

  const problems = [];
  for (const [section, expected] of Object.entries(declared)) {
    const got = parsed[section] ?? 0;
    if (got !== expected) {
      problems.push(`  "${section}": heading declares ${expected}, parsed ${got}`);
    }
  }
  for (const section of Object.keys(parsed)) {
    if (!(section in declared)) {
      problems.push(`  "${section}": parsed ${parsed[section]}, but no heading declares a count`);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `${path} and the parsed catalog disagree on how many fields exist:\n` +
        problems.join("\n") +
        `\n\nEither a table's shape changed, or a heading's count is stale.`,
    );
  }
}

/**
 * Throws if the prose totals at the top of the doc disagree with the tables
 * underneath them. The section headings are checked by assertSectionCounts;
 * these four sentences are the last field counts a human maintains, and they
 * were wrong for months ("68 fields across 13 categories" against 100 across
 * 14) because nothing read them.
 *
 * Prose is matched against the file with whitespace collapsed, so re-wrapping
 * a paragraph does not break the check. A claim that has been reworded past
 * recognition throws rather than passing quietly: an unfindable claim and a
 * satisfied one are not the same result.
 *
 * @param {ParsedField[]} fields
 */
export function assertHeaderTotals(fields, path = "docs/client-fields.md") {
  const prose = readFileSync(path, "utf8").replace(/\s+/g, " ");
  const problems = [];

  /** Pulls one claim's numbers, or records that the claim itself has gone missing. */
  const claim = (label, re) => {
    const m = prose.match(re);
    if (!m) {
      problems.push(
        `  the "${label}" claim is no longer in the doc, or has been reworded ` +
          `past what this check recognises (${re.source})`,
      );
      return null;
    }
    return m.slice(1).map(Number);
  };

  const check = (what, expected, got) => {
    if (expected !== got) problems.push(`  ${what}: doc says ${expected}, tables give ${got}`);
  };

  const sections = new Set(fields.map((f) => f.section));
  const live = fields.filter((f) => f.now === "live").length;
  const blocked = fields.filter((f) => f.now === "blocked");
  const slackBlocked = blocked.filter((f) => f.sectionNumber === "7b").length;

  const totals = claim("N fields across M categories", /(\d+) fields across (\d+) categories\./);
  if (totals) {
    check("total fields", totals[0], fields.length);
    check("categories", totals[1], sections.size);
  }

  const ships = claim(
    "X of Y ship against live integrations",
    /\*\*(\d+) of (\d+) ship against live integrations today\.\*\*/,
  );
  if (ships) {
    check("fields shipping today", ships[0], live);
    check("total fields (in the shipping claim)", ships[1], fields.length);
  }

  const split = claim(
    "the split of blocked fields",
    /Of the (\d+) marked ○, (\d+) wait on Story 4\.1 \(Meta setup\) and (\d+) are the §7b Slack fields\./,
  );
  if (split) {
    check("fields blocked on an integration", split[0], blocked.length);
    check("fields waiting on Story 4.1", split[1], blocked.length - slackBlocked);
    check("§7b Slack fields waiting", split[2], slackBlocked);
  }

  if (problems.length > 0) {
    throw new Error(
      `${path}'s summary totals disagree with its own tables:\n` +
        problems.join("\n") +
        `\n\nThe tables are the source of truth. Update the prose, not the tables.`,
    );
  }
}

/** @returns {ParsedField[]} */
export function parseFieldCatalog(path = "docs/client-fields.md") {
  const lines = readFileSync(path, "utf8").split("\n");
  /** @type {ParsedField[]} */
  const fields = [];
  let section = null;
  let sectionNumber = null;
  /** @type {Record<string, number> | null} */
  let roleIndex = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const heading = line.match(/^##\s+(?:(\d+b?)\.\s+)?(.+?)\s*(?:\(\d+\))?\s*$/);
    if (heading && /^##\s+\d/.test(line)) {
      section = heading[2].trim();
      sectionNumber = heading[1] ?? null;
    }

    const cells = rowCells(line);
    if (!cells) continue;

    // A header is any row followed by a rule. Re-reading it per table is what
    // keeps an extra column in one table from shifting every mark in it.
    if (i + 1 < lines.length && isSeparator(lines[i + 1])) {
      roleIndex = roleIndexFrom(cells);
      continue;
    }

    const id = cells[0].match(/^`([^`]+)`$/);
    if (!id) continue;
    // Backticked first cell outside a field table: a different table entirely.
    if (!roleIndex) continue;

    /** @type {Record<string, FieldVisibility>} */
    const visibility = {};
    for (const col of ROLE_COLUMNS) {
      const raw = cells[roleIndex[col]];
      const mark = MARK[raw];
      if (!mark) {
        throw new Error(
          `docs/client-fields.md:${i + 1}: field \`${id[1]}\` has no readable ` +
            `visibility mark in column ${col} (found ${JSON.stringify(raw)}). ` +
            `Expected one of ${Object.keys(MARK).join(" ")}.`,
        );
      }
      visibility[ROLE_BY_COLUMN[col]] = mark;
    }

    const nowRaw = cells[roleIndex.NOW];
    const now = NOW_MARK[nowRaw];
    if (!now) {
      throw new Error(
        `docs/client-fields.md:${i + 1}: field \`${id[1]}\` has no readable NOW ` +
          `mark (found ${JSON.stringify(nowRaw)}). Expected one of ` +
          `${Object.keys(NOW_MARK).join(" ")}.`,
      );
    }

    fields.push({
      id: id[1],
      label: cells[roleIndex.Field],
      src: cells[roleIndex.SRC],
      section,
      sectionNumber,
      now,
      visibility,
    });
  }

  return fields;
}

if (process.argv[1]?.endsWith("parse-field-catalog.mjs")) {
  const fields = parseFieldCatalog();
  assertSectionCounts(fields);
  assertHeaderTotals(fields);
  console.log(`parsed ${fields.length} fields`);
  const never = fields.filter((f) =>
    ["client_owner", "client_manager", "client_closer"].every(
      (r) => f.visibility[r] === "never",
    ),
  );
  console.log(`invisible to every client role: ${never.length}`);
  console.log(never.map((f) => f.id).join(", "));
}
