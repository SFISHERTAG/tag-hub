#!/usr/bin/env node
/**
 * Stranded webhook claim detector.  READ ONLY — performs no writes.
 *
 * The defect: a claim in `webhookEventsProcessed` is written BEFORE the work
 * (phase1-provisioning.ts:76) and nothing ever writes a completion field.  If the
 * process dies mid-provisioning the catch never runs, the claim persists with no
 * TTL and no sweeper, and every redelivery is answered `{success:true,
 * duplicate:true}` — so the client is never provisioned and the sender is told it
 * succeeded.
 *
 * WHAT THIS CAN AND CANNOT SEE, because an earlier version of this file claimed a
 * join it did not have and printed reassurance it could not support:
 *
 *   phase1  DETECTABLE, two independent ways.  The claim id is
 *           `phase1:<opportunityId>` (phase1-provisioning.ts:66) and
 *           `phase1_started` logs `details.opportunityId`
 *           (phase1-provisioning.ts:93-99), so claims join to starts.  Starts
 *           also join to completions by location.
 *
 *   phase3  DETECTABLE FROM THE LOG SIDE ONLY.  `phase3_started` is written
 *           (phase3-meta-setup.ts:85) but its details are
 *           `{hasMetaAccount, metaAdAccountId}` — no opportunityId — and the
 *           claim id is a content hash (phase3-meta-setup.ts:49).  So claims
 *           cannot be joined; starts without completions still can.
 *
 *   phase2  NOT DETECTABLE AT ALL, and that is a defect in the code rather than
 *           a limit of this script.  `phase2_started` is NEVER WRITTEN: it exists
 *           only as a union member at firestore.ts:122, and phase2-intake-submit.ts
 *           logs no start event.  Its claim id is a content hash
 *           (phase2-intake-submit.ts:48).  Neither side has a handle, so a
 *           stranded phase2 claim is invisible to any query.  Reported as a blind
 *           spot, never counted as clean.
 *
 * Prints NO email addresses or client names.  Ids and counts only.
 *
 * Run:  cd functions && node ../scripts/find-stranded-claims.mjs
 */
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(join(process.cwd(), "package.json"));
let Firestore;
try {
  ({ Firestore } = require("@google-cloud/firestore"));
} catch {
  console.error("Could not load @google-cloud/firestore from " + process.cwd());
  console.error("Run this from the functions/ directory:");
  console.error("  cd /Users/home/projects/TAG/functions && node ../scripts/find-stranded-claims.mjs");
  process.exit(1);
}

const STARTED = { phase1: "phase1_started", phase3: "phase3_started" };
const DONE = { phase1: "phase1_complete", phase3: "phase3_setup_guide_sent" };

const isContentHash = (s) => /^[0-9a-f]{64}$/.test(s);
const ms = (v) => (v instanceof Date ? v.getTime() : typeof v === "number" ? v : null);

/**
 * Classification, as a pure function of the two collections.
 *
 * Extracted and exported so it can be exercised on NON-EMPTY input without
 * Firestore. The previous version of this file had only ever been run against an
 * empty database, so every branch below was unexecuted code shipped with a
 * confident header — which is how it carried a join that does not exist for two
 * of the three sources. See test/find-stranded-claims.test.ts.
 */
export function classifyClaims(claimDocs, events, nowMs) {
  const claims = { stranded: [], complete: [], noStart: [], unjoinable: [], indeterminate: [] };

  for (const doc of claimDocs) {
    const [source, ...rest] = doc.id.split(":");
    const eventId = rest.join(":");
    const claimedAt = ms(doc.processedAt ?? null);
    const ageH = claimedAt === null ? "?" : ((nowMs - claimedAt) / 3.6e6).toFixed(1);
    const row = { source, eventId, ageH, claimedAt };

    if (source !== "phase1" || isContentHash(eventId)) {
      claims.unjoinable.push(row);
      continue;
    }

    const started = events.find((e) => e.type === STARTED.phase1 && e.opportunityId === eventId);
    if (!started) {
      // Also where a caller-supplied x-idempotency-key lands. That header is
      // taken verbatim (phase1-provisioning.ts:66) and an arbitrary string is
      // indistinguishable here from a delivery that died before logging.
      claims.noStart.push(row);
      continue;
    }

    // The completion must come AFTER this start. Joining on location alone is
    // safe for phase1 today only because it clones a NEW location per run;
    // requiring the ordering is what stops an earlier run's completion from
    // clearing a later stranded claim.
    //
    // FAILS CLOSED. An earlier version wrote this as one `some()` with
    // `ts === null ||` inside it, which made a missing timestamp SKIP the
    // ordering requirement and silently revert to the locationId-only join —
    // reinstating the false negative the check was added to prevent, in the
    // most reassuring bucket there is. A claim whose ordering cannot be
    // established is indeterminate, never complete.
    const resolved = { ...row, locationId: started.locationId };
    const candidates = events.filter(
      (e) => e.locationId === started.locationId && e.type === DONE.phase1,
    );
    const decidable = started.ts === null ? [] : candidates.filter((e) => e.ts !== null);

    if (!candidates.length) claims.stranded.push(resolved);
    else if (decidable.some((e) => e.ts >= started.ts)) claims.complete.push(resolved);
    else if (decidable.length < candidates.length) claims.indeterminate.push(resolved);
    else claims.stranded.push(resolved);
  }

  return claims;
}

/**
 * Starts with no later completion at the same location. Independent of claim ids.
 *
 * Same fail-closed rule as `classifyClaims`: a start whose ordering against its
 * candidate completions cannot be established is reported as indeterminate
 * rather than quietly treated as finished.
 */
export function findOrphanStarts(events) {
  const orphans = [];
  const indeterminate = [];

  for (const source of ["phase1", "phase3"]) {
    for (const start of events.filter((e) => e.type === STARTED[source])) {
      const entry = { source, locationId: start.locationId, ts: start.ts };
      const candidates = events.filter(
        (e) => e.locationId === start.locationId && e.type === DONE[source],
      );
      const decidable = start.ts === null ? [] : candidates.filter((e) => e.ts !== null);

      if (!candidates.length) orphans.push(entry);
      else if (decidable.some((e) => e.ts >= start.ts)) continue;
      else if (decidable.length < candidates.length) indeterminate.push(entry);
      else orphans.push(entry);
    }
  }

  return { orphans, indeterminate };
}

/**
 * Distinct INCIDENTS across the two sides.
 *
 * phase1 is detected on both sides, so the same incident appears twice. Claim
 * rows and start rows are different units and summing them double-counted every
 * phase1 stranding — the failure standing order 6 exists for. The log side
 * contributes only what the claim side did not already list.
 */
export function distinctIncidents(claims, orphans) {
  const claimSideKeys = new Set(claims.stranded.map((r) => `${r.source}:${r.locationId}`));
  const orphansOnly = orphans.filter((o) => !claimSideKeys.has(`${o.source}:${o.locationId}`));
  return {
    orphansOnly,
    count: claims.stranded.length + claims.noStart.length + orphansOnly.length,
  };
}

async function main() {
  // No fallback. CLAUDE.md forbids a hardcoded GCP project and names this exact
  // scenario — the silent fallback to production when the variable is unset. The
  // code this audits is stricter than an earlier version of this auditor was:
  // functions/src/lib/webhooks/idempotency.ts:8 passes the variable with no default.
  const PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
  if (!PROJECT) {
    console.error("GOOGLE_CLOUD_PROJECT is not set. Refusing to guess a project.");
    console.error("  GOOGLE_CLOUD_PROJECT=<project> node ../scripts/find-stranded-claims.mjs");
    process.exit(1);
  }
  const db = new Firestore({ projectId: PROJECT });
  console.log(`project: ${PROJECT}\n`);

  const [claimSnap, logSnap] = await Promise.all([
    db.collection("webhookEventsProcessed").get(),
    db.collectionGroup("provisioningLog").get(),
  ]);

  const events = logSnap.docs.map((d) => {
    const v = d.data();
    return {
      locationId: d.ref.parent.parent?.id ?? "(unknown)",
      type: v.type,
      opportunityId: v?.details?.opportunityId ?? null,
      ts: ms(v.timestamp?.toDate?.() ?? v.timestamp ?? null),
    };
  });

  console.log(`claims total:            ${claimSnap.size}`);
  console.log(`provisioningLog events:  ${logSnap.size}\n`);

  // ---- Claim side. phase1 only: it is the only source whose claim id joins. ----
  const claims = classifyClaims(
    claimSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    events,
    Date.now(),
  );

  console.log("CLAIM SIDE (phase1 only — no other source has a joinable claim id)");
  console.log(`  COMPLETE  claim + start + later finish:   ${claims.complete.length}`);
  console.log(`  STRANDED  claim + start, NO finish:       ${claims.stranded.length}`);
  console.log(`  NO START  claim, no matching start:       ${claims.noStart.length}`);
  console.log(`  INDETERMINATE  ordering unestablishable:  ${claims.indeterminate.length}`);
  console.log(`  UNJOINABLE  hash id, or not phase1:       ${claims.unjoinable.length}`);

  const bySource = {};
  for (const r of claims.unjoinable) bySource[r.source] = (bySource[r.source] ?? 0) + 1;
  if (claims.unjoinable.length) {
    console.log(`    by source: ${Object.entries(bySource).map(([k, v]) => `${k}=${v}`).join(" ")}`);
  }
  console.log("");

  // ---- Log side. Catches strandings the claim id cannot reach. ----
  //
  // phase1 appears on BOTH sides, so the same incident is detected twice. The
  // two lists are different units — claims and starts — and summing them
  // double-counted every phase1 stranding and printed it in both lists.
  // AGENT_COORDINATION.md standing order 6: never add across units or scopes.
  const { orphans, indeterminate: orphanIndeterminate } = findOrphanStarts(events);
  const { orphansOnly, count: found } = distinctIncidents(claims, orphans);

  console.log("LOG SIDE (started, never finished — independent of the claim id)");
  console.log(`  phase1: ${orphans.filter((o) => o.source === "phase1").length} start(s), of which ${orphansOnly.filter((o) => o.source === "phase1").length} not already listed claim-side`);
  console.log(`  phase3: ${orphans.filter((o) => o.source === "phase3").length} start(s)`);
  console.log(`  INDETERMINATE ordering:  ${orphanIndeterminate.length}\n`);

  for (const [name, list] of [["STRANDED CLAIMS", claims.stranded], ["NO START", claims.noStart]]) {
    if (!list.length) continue;
    console.log(`--- ${name} ---`);
    for (const r of list) {
      console.log(`  ${r.source}  event=${r.eventId}  location=${r.locationId ?? "(none)"}  age=${r.ageH}h`);
    }
    console.log("");
  }
  if (orphansOnly.length) {
    console.log("--- STARTED, NEVER FINISHED (not already listed above) ---");
    for (const o of orphansOnly) {
      console.log(`  ${o.source}  location=${o.locationId}  started=${o.ts ? new Date(o.ts).toISOString() : "?"}`);
    }
    console.log("");
  }

  // ---- Verdict. Must account for every bucket that could hide a stranding. ----
  const phase2Claims = claims.unjoinable.filter((r) => r.source === "phase2").length;
  // Every bucket whose contents could be hiding a stranding, in one figure the
  // verdict can be honest about.
  const hidden =
    claims.unjoinable.length + claims.indeterminate.length + orphanIndeterminate.length;


  if (claimSnap.empty && logSnap.empty) {
    console.log("Both collections are EMPTY. Read that as 'nothing has ever run',");
    console.log("NOT as 'the defect has not fired'. Check deploy state and whether");
    console.log("the webhook sender is pointed at this project at all.");
    return;
  }

  if (found) {
    console.log(`${found} distinct incident(s) above: ${claims.stranded.length} stranded claim(s), ${claims.noStart.length} claim(s) with no start, ${orphansOnly.length} start(s) with no finish and no claim-side row.`);
    console.log("Counts carry their units and are not summed across them.");
  } else if (hidden) {
    console.log(`No stranded claims FOUND, and ${hidden} claim(s) could not be examined.`);
    console.log("That is not a clean result. Do not report it as one.");
  } else {
    console.log("No stranded claims, and every claim present was examinable.");
    console.log("The defect stays real: nothing prevents it, and there is no TTL or sweeper.");
  }

  if (phase2Claims) {
    console.log("");
    console.log(`WARNING: ${phase2Claims} phase2 claim(s) are STRUCTURALLY UNDETECTABLE.`);
    console.log("  phase2_started is never written (firestore.ts:122 is a union member with");
    console.log("  no writer), and the phase2 claim id is a content hash. Neither side has a");
    console.log("  handle, so a stranded phase2 claim looks identical to a healthy one.");
    console.log("  Fix the code, not this query: log a phase2_started carrying the join key.");
  }
}

const isCli = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isCli) main().catch((e) => {
  console.error("FAILED:", e.message);
  if (String(e.message).includes("invalid_rapt") || String(e.message).includes("invalid_grant")) {
    console.error("\nCredentials need an interactive reauth. Run:");
    console.error("  gcloud auth application-default login");
  }
  process.exit(1);
});
