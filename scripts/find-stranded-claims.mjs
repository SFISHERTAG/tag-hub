#!/usr/bin/env node
/**
 * Stranded webhook claim detector.  READ ONLY — performs no writes.
 *
 * Settles BREAK-3: a claim in `webhookEventsProcessed` is written BEFORE the work
 * (phase1-provisioning.ts:76) and nothing ever writes a completion field.  If the
 * process dies mid-provisioning the catch never runs, the claim persists forever,
 * and every GHL redelivery is answered `{success:true, duplicate:true}` — so the
 * client is never provisioned and the sender is told it succeeded.
 *
 * Join key: phase1 logs `details.opportunityId` on its `phase1_started` event
 * (phase1-provisioning.ts:95-99), and the claim doc id is `phase1:<opportunityId>`
 * (phase1-provisioning.ts:66).  Same shape for phase2/phase3.
 *
 * Prints NO email addresses or client names.  Ids and counts only.
 *
 * Run:  cd functions && node /path/to/stranded-claims.mjs
 */
import { createRequire } from "node:module";
import { join } from "node:path";

// Resolve the dependency from the working directory, not from wherever this
// file happens to live, so it runs from `functions/` without being copied in.
const require = createRequire(join(process.cwd(), "package.json"));
let Firestore;
try {
  ({ Firestore } = require("@google-cloud/firestore"));
} catch {
  console.error("Could not load @google-cloud/firestore from " + process.cwd());
  console.error("Run this from the functions/ directory:");
  console.error("  cd /Users/home/projects/TAG/functions && node <path-to-this-file>");
  process.exit(1);
}

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "tag-success-hub";
const db = new Firestore({ projectId: PROJECT });

const STARTED = { phase1: "phase1_started", phase2: "phase2_started", phase3: "phase3_started" };
const DONE = { phase1: "phase1_complete", phase2: "phase2_complete", phase3: "phase3_setup_guide_sent" };

const isContentHash = (s) => /^[0-9a-f]{64}$/.test(s);

async function main() {
  console.log(`project: ${PROJECT}\n`);

  const claimSnap = await db.collection("webhookEventsProcessed").get();
  if (claimSnap.empty) {
    console.log("webhookEventsProcessed is EMPTY. No claims, nothing stranded.");
    console.log("Note: an empty collection is also what you would see if the");
    console.log("functions have never run in this project. Check deploy state too.");
    return;
  }

  // Every provisioningLog entry across every location, fetched once.
  const logSnap = await db.collectionGroup("provisioningLog").get();
  const events = logSnap.docs.map((d) => {
    const v = d.data();
    return {
      locationId: d.ref.parent.parent?.id ?? "(unknown)",
      type: v.type,
      opportunityId: v?.details?.opportunityId ?? null,
      ts: v.timestamp?.toDate?.() ?? v.timestamp ?? null,
    };
  });

  const rows = { stranded: [], complete: [], unjoinable: [], noStart: [] };

  for (const doc of claimSnap.docs) {
    const [source, ...rest] = doc.id.split(":");
    const eventId = rest.join(":");
    const claimedAt = doc.data()?.processedAt ?? null;
    const ageH = claimedAt ? ((Date.now() - Number(claimedAt)) / 3.6e6).toFixed(1) : "?";

    // An eventId that is a sha256 came from contentEventId(), or the caller sent
    // x-idempotency-key. Either way it is not an opportunityId and will not join.
    if (isContentHash(eventId)) {
      rows.unjoinable.push({ source, eventId: eventId.slice(0, 12) + "…", ageH });
      continue;
    }

    const started = events.find((e) => e.type === STARTED[source] && e.opportunityId === eventId);
    if (!started) {
      rows.noStart.push({ source, eventId, ageH });
      continue;
    }
    const done = events.some((e) => e.locationId === started.locationId && e.type === DONE[source]);
    (done ? rows.complete : rows.stranded).push({
      source, eventId, locationId: started.locationId, ageH,
    });
  }

  const line = (s) => console.log(s);
  line(`claims total:            ${claimSnap.size}`);
  line(`provisioningLog events:  ${logSnap.size}`);
  line("");

  line(`COMPLETE (claim + start + finish):   ${rows.complete.length}`);
  line(`STRANDED (claim + start, NO finish): ${rows.stranded.length}   <-- BREAK-3 fired here`);
  line(`NO START (claim, never even logged): ${rows.noStart.length}   <-- died before line 95`);
  line(`UNJOINABLE (hash/idempotency-key):   ${rows.unjoinable.length}   <-- cannot decide, not a finding`);
  line("");

  for (const [name, list] of [["STRANDED", rows.stranded], ["NO START", rows.noStart]]) {
    if (!list.length) continue;
    line(`--- ${name} ---`);
    for (const r of list) {
      line(`  ${r.source}  event=${r.eventId}  location=${r.locationId ?? "(none created)"}  age=${r.ageH}h`);
    }
    line("");
  }

  if (!rows.stranded.length && !rows.noStart.length) {
    line("No stranded claims. BREAK-3 is real in the code and has not fired yet.");
    line("It stays a break: nothing prevents it, and there is no TTL or sweeper.");
  } else {
    line("Each row above is a delivery GHL was told succeeded and which did not.");
    line("Cross-check a row by hand before acting: this joins on opportunityId only.");
  }
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  if (String(e.message).includes("invalid_rapt") || String(e.message).includes("invalid_grant")) {
    console.error("\nCredentials need an interactive reauth. Run:");
    console.error("  gcloud auth application-default login");
  }
  process.exit(1);
});
