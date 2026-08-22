#!/usr/bin/env node
/**
 * Read-only audit of the Fulfillment pipeline against the client tracking sheet.
 *
 * Answers one question before anything is written: which clients on the sheet
 * already have an opportunity in the pipeline, which do not, and which
 * opportunities in the pipeline are not on the sheet.
 *
 * This script only ever issues GET requests. The write pass is a separate
 * script that consumes the plan file this one emits, so the gap list gets read
 * by a human before anything is created in a live account.
 *
 * Usage:
 *   GHL_TOKEN=... node scripts/fulfillment-audit.mjs \
 *     --csv "/path/to/TAG CLIENT TRACKING - CLIENT TRACKING.csv" \
 *     --location rb6hPt8Ue77L4abghRMc \
 *     --pipeline nTSEekGvPnHHZw6U7oOU \
 *     --out /tmp/fulfillment-plan.json
 *
 * GHL_TOKEN must be a token valid for the location: a Private Integration
 * Token from that sub-account, or a location token. Pass it on the command
 * line from your own terminal. Do not paste it into a chat transcript.
 */

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
const PIPELINE_ID = arg("pipeline");
const OUT_PATH = arg("out", "/tmp/fulfillment-plan.json");
const TOKEN = process.env.GHL_TOKEN;

const CHECK_ONLY = process.argv.includes("--check-token");

if (!TOKEN || !LOCATION_ID || (!CHECK_ONLY && (!CSV_PATH || !PIPELINE_ID))) {
  console.error(
    "Missing input.\n" +
      "  GHL_TOKEN env var is required.\n" +
      "  --csv, --location and --pipeline are required.\n" +
      "See the header of this file for an example.",
  );
  process.exit(1);
}

/* ---------------------------------------------------------------- */
/* http                                                              */
/* ---------------------------------------------------------------- */

async function get(path, searchParams = {}) {
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/json",
      Version: VERSION,
    },
  });

  const text = await response.text();
  if (!response.ok) {
    // The body is the only thing that distinguishes a scope problem from a
    // wrong-location problem, and they need opposite fixes.
    if (response.status === 401) {
      throw new Error(
        `GHL 401 on ${path}: ${text.slice(0, 200)}\n\n` +
          `The token was rejected outright. The usual cause is the wrong KIND of token:\n` +
          `  - A v1 "API Key" (Settings > Business Info) does NOT work on API v2. It fails exactly like this.\n` +
          `  - An agency/company token cannot read location endpoints. It has to be location-scoped.\n\n` +
          `What works: a Private Integration Token from THIS sub-account.\n` +
          `  Settings > Private Integrations > Create new integration, in location ${LOCATION_ID}.\n` +
          `  Scopes for this read-only audit: View Contacts, View Opportunities, View Pipelines.\n` +
          `  The token starts with "pit-". Pass it as GHL_TOKEN.\n\n` +
          `Also check the value survived the shell: quote it, and make sure there is no trailing newline.`,
      );
    }
    if (response.status === 403) {
      throw new Error(
        `GHL 403 on ${path}: ${text.slice(0, 300)}\n\n` +
          `The token is valid but is missing a scope for this endpoint, or is not ` +
          `scoped to location ${LOCATION_ID}. Add the missing scope to the ` +
          `Private Integration and regenerate.`,
      );
    }
    throw new Error(`GHL ${response.status} on ${path}: ${text.slice(0, 400)}`);
  }
  return JSON.parse(text);
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
 * Comparison key for account names.
 *
 * Entity suffixes are dropped because the sheet and GHL disagree on them
 * constantly ("Taxtrua" against "Taxtrua, PLLC", "Fabbi" against "FABBI LLC").
 * "cpa" is deliberately NOT dropped: it distinguishes real firms here.
 */
const SUFFIXES = new Set(["llc", "inc", "pllc", "pc", "corp", "co", "ltd", "incorporated"]);

function normalize(value) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !SUFFIXES.has(word))
    .join(" ")
    .trim();
}

/* ---------------------------------------------------------------- */
/* agency ownership                                                  */
/* ---------------------------------------------------------------- */

/**
 * Which agency or platform a client sits under, when it is not TAG's.
 *
 * This is not derivable from the sheet or from the API. A client inside
 * someone else's agency does not appear as an account from our seat at all,
 * which is exactly why it needs recording by hand: the absence looks identical
 * to a client who was never set up. Keyed by the same normalized name the
 * matcher uses, so "Bullet Proof Tax" and "bullet proof tax, llc" both hit.
 *
 * Blank means not recorded, NOT "belongs to TAG". Do not infer ownership from
 * an empty cell here.
 */
/**
 * Sheet company name -> the name the client actually goes by in GHL.
 *
 * The sheet is keyed by company, GHL is keyed by whoever signed. Matching on
 * name alone reported three clients as missing when they were already in the
 * pipeline under a person's name, and creating from that list would have made
 * duplicates. Confirmed by hand from the first audit run; add to it rather
 * than loosening the matcher, which would trade these false negatives for
 * false positives that are much harder to spot.
 */
const SHEET_ALIAS = new Map([
  ["make taxes fair", "tyler buechler"],
  ["casey l williams", "casey williams"],
  ["interactive tax advisors", "jim schrock"],
  ["busy", "aquarius johnson"],
]);

const EXTERNAL_AGENCY = new Map([
  ["bullet proof tax", "Adwizar"],
  ["make taxes fair", "HubSpot (not GHL)"],
]);

function agencyOf(client) {
  for (const key of [normalize(client.company), normalize(client.highlevelName)]) {
    if (key && EXTERNAL_AGENCY.has(key)) return EXTERNAL_AGENCY.get(key);
  }
  return "";
}

/* ---------------------------------------------------------------- */
/* main                                                              */
/* ---------------------------------------------------------------- */

/**
 * Distinguishes "this token is broken" from "this token is agency-scoped".
 *
 * Both surface as a 401 on a location endpoint, and they need different fixes:
 * the first means the value never arrived intact, the second means you need a
 * sub-account token instead. `/locations/search` is company-level, so an
 * agency token that works there and fails on `/opportunities/*` has told us
 * exactly which case we are in.
 */
/**
 * Describes the token's shape without ever printing it.
 *
 * A token that fails everywhere is usually not the token you think it is, and
 * the tell is structural: length, prefix, stray whitespace. Reporting the
 * secret itself into a terminal or a transcript to debug it is not worth the
 * exposure when four characters and a length answer the question.
 */
function describeToken(value) {
  const trimmed = value.trim();
  const facts = [
    `length ${value.length}` + (trimmed.length !== value.length
      ? ` (${value.length - trimmed.length} chars of surrounding whitespace, THIS BREAKS THE HEADER)`
      : ""),
    `starts with ${JSON.stringify(trimmed.slice(0, 4))}`,
  ];

  if (/\s/.test(trimmed)) facts.push("contains whitespace INSIDE the value, likely truncated on paste");

  const segments = trimmed.split(".");
  if (trimmed.startsWith("pit-")) facts.push("looks like a Private Integration Token");
  else if (segments.length === 3) facts.push("looks like a JWT, which is the v1 API key shape, not a v2 PIT");
  else facts.push("does not match a PIT or a JWT shape");

  return facts;
}

async function checkToken() {
  console.log("Token check.\n");
  console.log("Token shape (the value itself is never printed):");
  for (const fact of describeToken(TOKEN)) console.log(`  - ${fact}`);
  console.log("");
  try {
    const data = await get("/locations/search", { limit: 1 });
    const count = (data.locations ?? []).length;
    console.log(
      `Agency endpoint /locations/search: OK (${count} location(s) returned).\n` +
        `So the token itself is fine and is agency-scoped. It cannot read\n` +
        `location endpoints, which is why the audit 401s. Create a Private\n` +
        `Integration inside ${LOCATION_ID} and use that token instead.`,
    );
  } catch (error) {
    // 403 means GHL accepted the token and refused the endpoint, which is the
    // EXPECTED result for a sub-account token: /locations/search is an agency
    // endpoint. Reporting that as "the token is broken" sent the last run
    // chasing the wrong problem.
    const forbidden = / 403 /.test(error.message);
    console.log(
      `Agency endpoint /locations/search: ${forbidden ? "403 Forbidden" : "failed"}\n${error.message}\n\n` +
        (forbidden
          ? `That is a PASS for our purposes. The token was accepted and only\n` +
            `this agency-level endpoint was refused, which is exactly what a\n` +
            `sub-account token should do. Run the real audit now.`
          : `The token is not being accepted anywhere, so this is the token\n` +
            `value itself, not its scope. Re-copy it and check for whitespace.`),
    );
  }
}

async function main() {
  const { readFileSync, writeFileSync } = await import("node:fs");

  console.log("READ-ONLY. This script issues no writes.\n");

  // --- the sheet ---
  const rows = parseCsv(readFileSync(CSV_PATH, "utf8"));
  const header = rows.findIndex((r) => r.includes("COMPANY NAME"));
  if (header === -1) throw new Error("Could not find the COMPANY NAME header row in the CSV.");

  const col = Object.fromEntries(rows[header].map((name, index) => [name.trim(), index]));
  const clients = rows
    .slice(header + 1)
    .filter((r) => (r[col["COMPANY NAME"]] || "").trim())
    .map((r) => ({
      active: (r[col["Active"]] || "").trim().toUpperCase() === "TRUE",
      company: (r[col["COMPANY NAME"]] || "").trim(),
      contact: (r[col["FULL NAME"]] || "").trim(),
      email: (r[col["EMAIL ADDRESS"]] || "").trim(),
      highlevelName: (r[col["HighLevel Name"]] || "").trim(),
      notes: (r[col["Client Notes:"]] || "").trim(),
    }))
    .map((client) => ({ ...client, agency: agencyOf(client) }));

  console.log(
    `Sheet: ${clients.length} rows, ${clients.filter((c) => c.active).length} active, ` +
      `${clients.filter((c) => !c.active).length} inactive.`,
  );

  // --- the pipeline ---
  const { pipelines = [] } = await get("/opportunities/pipelines", {
    locationId: LOCATION_ID,
  });
  const pipeline = pipelines.find((p) => p.id === PIPELINE_ID);
  if (!pipeline) {
    throw new Error(
      `Pipeline ${PIPELINE_ID} not found at location ${LOCATION_ID}. ` +
        `Available: ${pipelines.map((p) => `${p.name} (${p.id})`).join(", ") || "none"}`,
    );
  }

  const stages = [...(pipeline.stages ?? [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );
  console.log(`\nPipeline "${pipeline.name}" (${pipeline.id}), ${stages.length} stages:`);
  for (const stage of stages) console.log(`  ${stage.position}. ${stage.name}  [${stage.id}]`);

  const offboarded = stages.find((s) => normalize(s.name) === "off boarded");
  console.log(
    offboarded
      ? `\n"off-boarded" stage present: ${offboarded.id}`
      : `\n"off-boarded" stage NOT present yet. Create it in the GHL UI before the write pass.`,
  );

  // --- existing opportunities ---
  const opportunities = [];
  for (let page = 1; page <= 20; page++) {
    const data = await get("/opportunities/search", {
      location_id: LOCATION_ID,
      pipeline_id: PIPELINE_ID,
      status: "all",
      limit: 100,
      page,
    });
    const batch = data.opportunities ?? [];
    opportunities.push(...batch);
    if (batch.length < 100) break;
  }
  console.log(`\nOpportunities in pipeline: ${opportunities.length}`);

  // --- every contact in the sub-account, and whether it has an opportunity ---
  //
  // The sheet-first pass below answers "is this client in the pipeline". This
  // one answers the inverse, "who is in this sub-account at all", which is the
  // only way to find clients that exist in GHL and on no list anywhere.
  const contacts = [];
  const seenContactIds = new Set();
  let startAfter;
  let startAfterId;
  let contactsTruncated = true;

  for (let page = 0; page < 30; page++) {
    const data = await get("/contacts/", {
      locationId: LOCATION_ID,
      limit: 100,
      startAfter,
      startAfterId,
    });
    const batch = data.contacts ?? [];
    if (!batch.length) {
      contactsTruncated = false;
      break;
    }
    for (const contact of batch) {
      // A cursor that fails to advance would otherwise re-read the same page.
      if (seenContactIds.has(contact.id)) continue;
      seenContactIds.add(contact.id);
      contacts.push(contact);
    }
    startAfter = data.meta?.startAfter;
    startAfterId = data.meta?.startAfterId;
    if (startAfterId == null) {
      contactsTruncated = false;
      break;
    }
  }

  const opportunityByContact = new Map();
  for (const opportunity of opportunities) {
    const id = opportunity.contact?.id ?? opportunity.contactId;
    if (id && !opportunityByContact.has(id)) opportunityByContact.set(id, opportunity);
  }

  const stageName = (opportunity) =>
    stages.find((s) => s.id === opportunity.pipelineStageId)?.name ?? opportunity.pipelineStageId;

  const contactLabel = (contact) => {
    const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
    return (
      contact.companyName?.trim() ||
      name ||
      contact.email ||
      contact.phone ||
      contact.id
    );
  };

  const withOpportunity = contacts.filter((c) => opportunityByContact.has(c.id));
  const withoutOpportunity = contacts.filter((c) => !opportunityByContact.has(c.id));

  console.log(`\nContacts in ${LOCATION_ID}: ${contacts.length}`);
  if (contactsTruncated) {
    // Say it rather than quietly reporting an undercount as a complete answer.
    console.log("  WARNING: page cap hit. This list is INCOMPLETE.");
  }

  console.log(`\nCONTACTS WITH A FULFILLMENT OPPORTUNITY (${withOpportunity.length})`);
  for (const contact of withOpportunity) {
    const opportunity = opportunityByContact.get(contact.id);
    console.log(
      `  ${contactLabel(contact)}  [${contact.id}]  -> "${opportunity.name}" @ ${stageName(opportunity)}`,
    );
  }

  console.log(`\nCONTACTS WITH NO FULFILLMENT OPPORTUNITY (${withoutOpportunity.length})`);
  for (const contact of withoutOpportunity) {
    console.log(`  ${contactLabel(contact)}  [${contact.id}]  ${contact.email || ""}`);
  }

  // --- match ---
  const byKey = new Map();
  for (const opportunity of opportunities) {
    for (const key of [
      normalize(opportunity.name),
      normalize(opportunity.contact?.name),
      normalize(opportunity.contact?.companyName),
    ]) {
      if (key && !byKey.has(key)) byKey.set(key, opportunity);
    }
  }

  const matched = [];
  const missing = [];
  const claimed = new Set();

  for (const client of clients) {
    const keys = [
      normalize(client.highlevelName),
      normalize(client.company),
      normalize(client.contact),
      SHEET_ALIAS.get(normalize(client.company)) ?? "",
    ];
    const hit = keys.map((k) => (k ? byKey.get(k) : undefined)).find(Boolean);
    if (hit) {
      claimed.add(hit.id);
      matched.push({
        ...client,
        opportunityId: hit.id,
        opportunityName: hit.name,
        stage: stages.find((s) => s.id === hit.pipelineStageId)?.name ?? hit.pipelineStageId,
      });
    } else {
      missing.push(client);
    }
  }

  const unclaimed = opportunities.filter((o) => !claimed.has(o.id));

  // Notes attach to contacts, not opportunities, so the write pass needs the
  // linked contact id. Fetching existing notes here is what makes that pass
  // idempotent: re-running must not stack a second copy of the same note on a
  // client who already has it. Clients with an empty Client Notes cell are
  // skipped outright rather than given a blank note.
  for (const match of matched) {
    match.contactId = null;
    match.noteAlreadyPresent = false;

    if (!match.notes) continue;

    const opportunity = opportunities.find((o) => o.id === match.opportunityId);
    const contactId = opportunity?.contact?.id ?? opportunity?.contactId ?? null;
    match.contactId = contactId;
    if (!contactId) continue;

    try {
      const { notes = [] } = await get(`/contacts/${contactId}/notes`);
      match.noteAlreadyPresent = notes.some(
        (note) => (note.body ?? "").trim() === match.notes.trim(),
      );
    } catch (error) {
      // A note read failing is not fatal to the audit — it just means the
      // write pass cannot claim this one is safe to skip.
      match.noteReadError = error.message;
    }
  }

  const show = (label, list, render) => {
    console.log(`\n${label} (${list.length})`);
    if (!list.length) console.log("  none");
    for (const item of list) console.log(`  ${render(item)}`);
  };

  const agencyTag = (c) => (c.agency ? `  [agency: ${c.agency}]` : "");

  show("IN PIPELINE, active", matched.filter((m) => m.active), (m) =>
    `${m.company} -> "${m.opportunityName}" @ ${m.stage}${agencyTag(m)}`);
  show("IN PIPELINE, inactive (off-boarding candidates)", matched.filter((m) => !m.active), (m) =>
    `${m.company} -> "${m.opportunityName}" @ ${m.stage}${agencyTag(m)}`);
  show("NOT IN PIPELINE, active (would be created)", missing.filter((m) => m.active), (m) =>
    `${m.company}  [${m.contact || "no contact"} ${m.email || ""}]${agencyTag(m)}`);
  show("NOT IN PIPELINE, inactive", missing.filter((m) => !m.active), (m) =>
    `${m.company}  [${m.contact || "no contact"}]${agencyTag(m)}`);
  show("IN PIPELINE, not on the sheet (needs your call)", unclaimed, (o) =>
    `"${o.name}" @ ${stages.find((s) => s.id === o.pipelineStageId)?.name ?? "?"}  [${o.id}]`);

  const notesToAdd = matched.filter((m) => m.notes && !m.noteAlreadyPresent && m.contactId);
  show("NOTES TO ADD (would be written verbatim from the sheet)", notesToAdd, (m) =>
    `${m.company}: ${JSON.stringify(m.notes)}`);

  show(
    "NOTE BLOCKED, no linked contact",
    matched.filter((m) => m.notes && !m.contactId),
    (m) => `${m.company} -> "${m.opportunityName}" has no contact to attach a note to`,
  );

  const alreadyNoted = matched.filter((m) => m.noteAlreadyPresent);
  console.log(`\nNotes already present, would be skipped: ${alreadyNoted.length}`);
  const noNote = matched.filter((m) => !m.notes).concat(missing.filter((m) => !m.notes));
  console.log(`Clients with an empty note cell, nothing to write: ${noNote.length}`);

  // Near-misses between what is still unmatched on each side. Reported, never
  // applied: a shared surname is a hint for a human, not grounds for writing
  // to a live record.
  const tokens = (value) => new Set(normalize(value).split(" ").filter(Boolean));
  const suggestions = [];
  for (const client of missing) {
    const clientTokens = new Set([
      ...tokens(client.company),
      ...tokens(client.contact),
      ...tokens(client.highlevelName),
    ]);
    for (const opportunity of unclaimed) {
      const shared = [...tokens(opportunity.name)].filter((t) => clientTokens.has(t) && t.length > 2);
      if (shared.length) {
        suggestions.push(`${client.company}  ~=  "${opportunity.name}"  (shared: ${shared.join(", ")})`);
      }
    }
  }
  show("POSSIBLE MATCHES, confirm by hand before any write", suggestions, (line) => line);

  // Duplicates. A note written to the wrong copy lands where nobody looks.
  const groupDuplicates = (items, keyOf, labelOf) => {
    const groups = new Map();
    for (const item of items) {
      const key = keyOf(item);
      if (!key) continue;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups.values()]
      .filter((group) => group.length > 1)
      .map((group) => `${labelOf(group[0])} x${group.length}: ${group.map((i) => i.id).join(", ")}`);
  };

  show(
    "DUPLICATE OPPORTUNITIES in this pipeline",
    groupDuplicates(opportunities, (o) => normalize(o.name), (o) => o.name),
    (line) => line,
  );
  show(
    "DUPLICATE CONTACTS (one copy usually holds the opportunity)",
    groupDuplicates(contacts, (c) => normalize(contactLabel(c)), (c) => contactLabel(c)),
    (line) => line,
  );

  const external = [...matched, ...missing].filter((c) => c.agency);
  show("WITH A DIFFERENT AGENCY OR PLATFORM", external, (c) =>
    `${c.company} -> ${c.agency}${c.active ? "" : " (inactive)"}`);

  writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        locationId: LOCATION_ID,
        pipelineId: PIPELINE_ID,
        pipelineName: pipeline.name,
        stages,
        offboardedStageId: offboarded?.id ?? null,
        contacts: contacts.map((c) => ({
          id: c.id,
          label: contactLabel(c),
          email: c.email ?? null,
          opportunityId: opportunityByContact.get(c.id)?.id ?? null,
        })),
        contactsTruncated,
        matched,
        missing,
        unclaimed: unclaimed.map((o) => ({ id: o.id, name: o.name, stageId: o.pipelineStageId })),
      },
      null,
      2,
    ),
  );
  console.log(`\nPlan written to ${OUT_PATH}. Nothing was changed.`);
}

const entry = process.argv.includes("--check-token") ? checkToken : main;

entry().catch((error) => {
  console.error(`\nFAILED: ${error.message}`);
  process.exit(1);
});
