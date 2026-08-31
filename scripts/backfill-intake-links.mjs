#!/usr/bin/env node
/**
 * Writes each client's intake doc link from the tracking sheet into a custom
 * field on their GHL contact.
 *
 * Two passes, and the first one writes nothing. The default run resolves every
 * row to a contact, prints exactly what it would set, and exits. `--apply`
 * repeats that plan and then PUTs it. The reason for the split is that email
 * matching against a live account is the risky part, not the write: a sheet
 * row that resolves to two contacts, or to the wrong one, is invisible in a
 * success count and obvious in a plan.
 *
 * Source tab: "TDC CLIENT TRACKING" of the TAG CLIENT TRACKING sheet. That is
 * the only tab whose Intake Form column holds URLs. The "CLIENT TRACKING" tab
 * (the tax firms) holds intake doc TITLES, not links, so it cannot be a source
 * for this script until those links exist somewhere.
 *
 * Export the tab with File > Download > CSV, which yields a file named like
 * "TAG CLIENT TRACKING - TDC CLIENT TRACKING.csv".
 *
 * Usage:
 *   # 1. see which custom fields exist on the location
 *   GHL_TOKEN=... node scripts/backfill-intake-links.mjs \
 *     --location <locationId> --list-fields
 *
 *   # 2. dry run: resolve contacts and print the plan, write nothing
 *   GHL_TOKEN=... node scripts/backfill-intake-links.mjs \
 *     --csv "/path/to/TAG CLIENT TRACKING - TDC CLIENT TRACKING.csv" \
 *     --location <locationId> --field <customFieldId>
 *
 *   # 3. same plan, then write it
 *   ... --apply
 *
 * By default a contact whose field already holds a DIFFERENT value is left
 * alone and reported. Pass --overwrite to replace those too.
 *
 * GHL_TOKEN must be a Private Integration Token from that sub-account, with
 * View Contacts, Edit Contacts and View Custom Fields. Pass it from your own
 * terminal. Do not paste it into a chat transcript.
 */

import { readFileSync } from "node:fs";

const BASE_URL = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

/* ---------------------------------------------------------------- */
/* args                                                              */
/* ---------------------------------------------------------------- */

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || index === process.argv.length - 1) return fallback;
  return process.argv[index + 1];
}

const CSV_PATH = arg("csv");
const LOCATION_ID = arg("location");
const FIELD = arg("field");
const TOKEN = process.env.GHL_TOKEN;

const LIST_FIELDS = process.argv.includes("--list-fields");
const MATCH_ONLY = process.argv.includes("--match-only");
const APPLY = process.argv.includes("--apply");
const OVERWRITE = process.argv.includes("--overwrite");

if (
  !TOKEN ||
  !LOCATION_ID ||
  (!LIST_FIELDS && !CSV_PATH) ||
  (!LIST_FIELDS && !MATCH_ONLY && !FIELD)
) {
  console.error(
    "Missing input.\n" +
      "  GHL_TOKEN env var is required.\n" +
      "  --location is always required.\n" +
      "  --csv is required unless --list-fields.\n" +
      "  --field is required unless --list-fields or --match-only.\n" +
      "See the header of this file for an example.",
  );
  process.exit(1);
}

/* ---------------------------------------------------------------- */
/* http                                                              */
/* ---------------------------------------------------------------- */

async function request(path, { method = "GET", searchParams = {}, body } = {}) {
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/json",
      Version: VERSION,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  if (!response.ok) {
    // The body is the only thing that distinguishes a scope problem from a
    // wrong-location problem, and they need opposite fixes.
    if (response.status === 401) {
      throw new Error(
        `GHL 401 on ${path}: ${text.slice(0, 200)}\n\n` +
          `The token was rejected outright. The usual cause is the wrong KIND of token:\n` +
          `  - A v1 "API Key" does NOT work on API v2. It fails exactly like this.\n` +
          `  - An agency/company token cannot reach location endpoints.\n\n` +
          `What works: a Private Integration Token from THIS sub-account.\n` +
          `  Settings > Private Integrations, in location ${LOCATION_ID}.\n` +
          `  Scopes: View Contacts, Edit Contacts, View Custom Fields.\n` +
          `  The token starts with "pit-". Pass it as GHL_TOKEN.\n\n` +
          `Also check the value survived the shell: quote it, and make sure there is no trailing newline.`,
      );
    }
    if (response.status === 403) {
      throw new Error(
        `GHL 403 on ${path}: ${text.slice(0, 300)}\n\n` +
          `The token is valid but is missing a scope for this endpoint, or is ` +
          `not scoped to location ${LOCATION_ID}. Edit Contacts is the scope ` +
          `most likely missing on a token created for a read-only pass.`,
      );
    }
    throw new Error(`GHL ${response.status} on ${path}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : {};
}

/* ---------------------------------------------------------------- */
/* csv                                                               */
/* ---------------------------------------------------------------- */

/** Minimal RFC4180 reader. The sheet has quoted fields with embedded newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += char;
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") field += char;
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Pulls (name, email, link) out of the TDC tab.
 *
 * The tab has TWO columns headed "Intake Form": the first holds the doc URL,
 * the second holds the doc's title. Indexing by header name alone would pick
 * whichever came last, so the URL column is identified by content instead: the
 * first cell in the row that parses as an http(s) URL. That also means a row
 * whose link is missing (Crystal Bean, at time of writing) drops out here
 * rather than writing an empty string over a real value later.
 */
function readRows(csvText) {
  const rows = parseCsv(csvText);
  const headerIndex = rows.findIndex(
    (r) =>
      r.some((c) => c.trim().toLowerCase() === "name") &&
      r.some((c) => c.trim().toLowerCase() === "email"),
  );
  if (headerIndex === -1) {
    throw new Error(
      "No header row with both Name and Email. Is this the TDC CLIENT TRACKING tab?",
    );
  }

  const header = rows[headerIndex].map((c) => c.trim().toLowerCase());
  const nameCol = header.indexOf("name");
  const emailCol = header.indexOf("email");

  const out = [];
  const skipped = [];

  for (const row of rows.slice(headerIndex + 1)) {
    const name = (row[nameCol] ?? "").trim();
    const email = (row[emailCol] ?? "").trim().toLowerCase();
    if (!email) continue;

    const link = row.map((c) => c.trim()).find((c) => /^https?:\/\//i.test(c));

    if (!link) {
      skipped.push({ name, email, reason: "no link in row" });
      continue;
    }
    out.push({ name, email, link });
  }

  return { rows: out, skipped };
}

/* ---------------------------------------------------------------- */
/* ghl                                                               */
/* ---------------------------------------------------------------- */

async function listCustomFields(model = "contact") {
  const data = await request(`/locations/${LOCATION_ID}/customFields`, {
    searchParams: { model },
  });
  return data.customFields ?? [];
}

/**
 * List BOTH models, because scoping this to contacts once cost real work.
 *
 * An earlier run of --list-fields queried `model=contact` only, found no intake
 * link among 116 fields, and reported "the field does not exist on this
 * location". True as scoped and false as read: `opportunity.intake_form_url`
 * already existed and was the field actually wanted. A second session then
 * created a duplicate contact field on a production account off the back of
 * that report. The listing is the thing people reason from, so it shows
 * everything and labels which model each entry belongs to.
 */
async function listAllCustomFields() {
  const [contact, opportunity] = await Promise.all([
    listCustomFields("contact"),
    listCustomFields("opportunity"),
  ]);
  return [
    ...contact.map((f) => ({ ...f, model: "contact" })),
    ...opportunity.map((f) => ({ ...f, model: "opportunity" })),
  ];
}

/** Exact-email lookup. Returns every match, so ambiguity is visible. */
async function findContactsByEmail(email) {
  const data = await request("/contacts/search/duplicate", {
    searchParams: { locationId: LOCATION_ID, email },
  });
  // The duplicate endpoint returns a single `contact`, or null. Fall back to
  // the general search when it finds nothing, since a contact whose email
  // differs only in case or whitespace will not come back as a duplicate.
  if (data.contact) return [data.contact];

  const search = await request("/contacts/", {
    searchParams: { locationId: LOCATION_ID, query: email, limit: 20 },
  });
  return (search.contacts ?? []).filter(
    (c) => (c.email ?? "").trim().toLowerCase() === email,
  );
}

function currentValue(contact, fieldId) {
  const fields = contact.customFields ?? contact.customField ?? [];
  const hit = fields.find((f) => f.id === fieldId);
  if (!hit) return "";
  return String(hit.value ?? hit.field_value ?? "").trim();
}

async function setField(contactId, fieldId, value) {
  await request(`/contacts/${contactId}`, {
    method: "PUT",
    body: { customFields: [{ id: fieldId, value }] },
  });
}

/* ---------------------------------------------------------------- */
/* main                                                              */
/* ---------------------------------------------------------------- */

async function main() {
  if (LIST_FIELDS) {
    const all = await listAllCustomFields();
    console.log(`Custom fields on location ${LOCATION_ID}:\n`);
    for (const f of all) {
      console.log(
        `  ${f.model.padEnd(11)} ${f.id}  ${f.fieldKey ?? ""}  ${JSON.stringify(f.name)}  (${f.dataType})`,
      );
    }
    const c = all.filter((f) => f.model === "contact").length;
    console.log(
      `\n${all.length} field(s): ${c} contact, ${all.length - c} opportunity.\n` +
        `This script writes CONTACT fields only, so only a contact id is valid as\n` +
        `--field. An opportunity field listed here needs a different writer -- but\n` +
        `check whether one already holds what you are about to add.`,
    );
    return;
  }

  const fields = await listCustomFields("contact");

  // --match-only answers "do these people exist in this location, exactly
  // once each" without naming a destination field. That question has to be
  // settled before a field is created to hold the answer, and it is pure GET.
  if (MATCH_ONLY) {
    const { rows, skipped } = readRows(readFileSync(CSV_PATH, "utf8"));
    console.log(
      `Location: ${LOCATION_ID}\n` +
        `Rows:     ${rows.length} with a link, ${skipped.length} without\n` +
        `Mode:     MATCH ONLY (no field named, writes nothing)\n`,
    );
    const counts = {};
    for (const row of rows) {
      let matches;
      try {
        matches = await findContactsByEmail(row.email);
      } catch (error) {
        counts.ERROR = (counts.ERROR ?? 0) + 1;
        console.log(
          `  ${"ERROR".padEnd(10)} ${row.email.padEnd(38)} ${error.message.split("\n")[0]}`,
        );
        continue;
      }
      const action =
        matches.length === 0
          ? "NO-MATCH"
          : matches.length > 1
            ? "AMBIGUOUS"
            : "MATCH";
      counts[action] = (counts[action] ?? 0) + 1;
      const detail =
        matches.length === 1
          ? `${matches[0].id}  ${matches[0].firstName ?? ""} ${matches[0].lastName ?? ""}`.trim()
          : matches.length > 1
            ? matches.map((c) => c.id).join(", ")
            : "no contact with this email";
      console.log(`  ${action.padEnd(10)} ${row.email.padEnd(38)} ${detail}`);
    }
    for (const s of skipped) {
      console.log(
        `  ${"NO-LINK".padEnd(10)} ${s.email.padEnd(38)} ${s.reason}`,
      );
    }
    console.log(`\n${JSON.stringify(counts)}  no-link: ${skipped.length}`);
    return;
  }

  const target = fields.find((f) => f.id === FIELD || f.fieldKey === FIELD);
  if (!target) {
    throw new Error(
      `No contact custom field matches ${JSON.stringify(FIELD)} on location ` +
        `${LOCATION_ID}. Run with --list-fields to see what exists.\n\n` +
        `Refusing to guess: writing to a field id that does not exist here ` +
        `either 400s or silently lands nowhere, and the second is worse.`,
    );
  }

  const { rows, skipped } = readRows(readFileSync(CSV_PATH, "utf8"));
  console.log(
    `Field:    ${target.id} ${JSON.stringify(target.name)} (${target.dataType})\n` +
      `Location: ${LOCATION_ID}\n` +
      `Rows:     ${rows.length} with a link, ${skipped.length} without\n` +
      `Mode:     ${APPLY ? "APPLY (will write)" : "DRY RUN (writes nothing)"}` +
      `${OVERWRITE ? " --overwrite" : ""}\n`,
  );

  const plan = [];

  for (const row of rows) {
    let matches;
    try {
      matches = await findContactsByEmail(row.email);
    } catch (error) {
      plan.push({
        ...row,
        action: "ERROR",
        detail: error.message.split("\n")[0],
      });
      continue;
    }

    if (matches.length === 0) {
      plan.push({
        ...row,
        action: "NO-MATCH",
        detail: "no contact with this email",
      });
      continue;
    }
    if (matches.length > 1) {
      plan.push({
        ...row,
        action: "AMBIGUOUS",
        detail: `${matches.length} contacts share this email: ${matches.map((c) => c.id).join(", ")}`,
      });
      continue;
    }

    const contact = matches[0];
    const existing = currentValue(contact, target.id);

    if (existing === row.link) {
      plan.push({
        ...row,
        contactId: contact.id,
        action: "SKIP",
        detail: "already set to this link",
      });
    } else if (existing && !OVERWRITE) {
      plan.push({
        ...row,
        contactId: contact.id,
        action: "CONFLICT",
        detail: `holds a different value: ${existing.slice(0, 80)}`,
      });
    } else {
      plan.push({
        ...row,
        contactId: contact.id,
        action: "SET",
        detail: existing ? `replacing ${existing.slice(0, 60)}` : "empty",
      });
    }
  }

  for (const p of plan) {
    console.log(`  ${p.action.padEnd(10)} ${p.email.padEnd(38)} ${p.detail}`);
  }
  for (const s of skipped) {
    console.log(`  ${"NO-LINK".padEnd(10)} ${s.email.padEnd(38)} ${s.reason}`);
  }

  const writable = plan.filter((p) => p.action === "SET");
  const counts = plan.reduce(
    (acc, p) => ({ ...acc, [p.action]: (acc[p.action] ?? 0) + 1 }),
    {},
  );
  console.log(`\n${JSON.stringify(counts)}  no-link: ${skipped.length}`);

  if (!APPLY) {
    console.log(
      `\nDry run. Nothing was written. ${writable.length} contact(s) would be updated.\n` +
        `Re-run with --apply to write them.`,
    );
    return;
  }

  let written = 0;
  const failed = [];
  for (const p of writable) {
    try {
      await setField(p.contactId, target.id, p.link);
      written++;
    } catch (error) {
      failed.push({ email: p.email, message: error.message.split("\n")[0] });
    }
  }

  console.log(`\nWrote ${written} of ${writable.length}.`);
  for (const f of failed) console.log(`  FAILED ${f.email}: ${f.message}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
