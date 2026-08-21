/**
 * Parses docs/client-fields.md into the field catalog.
 *
 * The doc is the source of truth (docs/client-fields.md, "Four structural
 * decisions"). Hand-transcribing 68 rows x 7 roles is exactly the kind of task
 * where one mistyped dash silently grants a client TAG's margin — so the table
 * is parsed, never retyped, and test/field-catalog-drift.test.ts re-parses it
 * to fail CI if the generated file and the doc disagree.
 */
import { readFileSync } from "node:fs";

export const ROLE_COLUMNS = ["EX", "CS", "SM", "SL", "OW", "CM", "CL"];

export const ROLE_BY_COLUMN = {
  EX: "tag_exec",
  CS: "tag_csm",
  SM: "tag_sales_manager",
  SL: "tag_sales",
  OW: "client_owner",
  CM: "client_manager",
  CL: "client_closer",
};

const MARK = { "●": "on", "○": "available", "—": "never", "-": "never" };

export function parseFieldCatalog(path = "docs/client-fields.md") {
  const lines = readFileSync(path, "utf8").split("\n");
  const fields = [];
  let section = null;

  for (const line of lines) {
    const heading = line.match(/^##\s+(?:\d+b?\.\s+)?(.+?)\s*(?:\(\d+\))?\s*$/);
    if (heading && /^##\s+\d/.test(line)) section = heading[1].trim();

    // Data rows start with a backticked id in the first cell.
    const m = line.match(/^\|\s*`([^`]+)`\s*\|(.+)\|\s*$/);
    if (!m) continue;
    const cells = m[2].split("|").map((c) => c.trim());
    if (cells.length < 9) continue;

    const [label, src, , ...roleCells] = cells;
    const visibility = {};
    let ok = true;
    ROLE_COLUMNS.forEach((col, i) => {
      const mark = MARK[roleCells[i]];
      if (!mark) ok = false;
      visibility[ROLE_BY_COLUMN[col]] = mark;
    });
    if (!ok) continue;

    fields.push({ id: m[1], label, src, section, visibility });
  }
  return fields;
}

if (process.argv[1]?.endsWith("parse-field-catalog.mjs")) {
  const fields = parseFieldCatalog();
  console.log(`parsed ${fields.length} fields`);
  const never = fields.filter((f) =>
    ["client_owner", "client_manager", "client_closer"].every(
      (r) => f.visibility[r] === "never",
    ),
  );
  console.log(`invisible to every client role: ${never.length}`);
  console.log(never.map((f) => f.id).join(", "));
}
