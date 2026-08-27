import { describe, expect, it } from "vitest";
// @ts-expect-error - plain .mjs script, no type declarations
import {
  classifyClaims,
  distinctIncidents,
  findOrphanStarts,
} from "@/scripts/find-stranded-claims.mjs";

/**
 * The previous version of this script had only ever been run against an EMPTY
 * database. Every classification branch was unexecuted code shipped under a
 * confident header, and a review found four defects in it — including a join key
 * that does not exist for two of the three sources, and a reassurance line that
 * printed "has not fired yet" while stranded claims sat in a bucket the script
 * itself captioned "not a finding".
 *
 * These exercise the non-empty path, which is the gap that allowed all four.
 */

const HOUR = 3.6e6;
const NOW = Date.parse("2026-08-27T12:00:00.000Z");
const SHA = "a".repeat(64);

const claim = (id: string, hoursAgo = 2) => ({ id, processedAt: NOW - hoursAgo * HOUR });
// `hoursAgo: null` means the document has NO timestamp. Written explicitly
// because `NOW - null * HOUR` is `NOW`, not null — the first version of this
// helper silently produced a valid timestamp for every "missing" case and made
// three real tests fail for a reason that was the helper's fault, not the code's.
const ev = (
  locationId: string,
  type: string,
  hoursAgo: number | null,
  opportunityId?: string,
) => ({
  locationId,
  type,
  opportunityId: opportunityId ?? null,
  ts: hoursAgo === null ? null : NOW - hoursAgo * HOUR,
});

describe("classifyClaims — phase1, the only joinable source", () => {
  it("calls a claim with a start and a later finish COMPLETE", () => {
    const r = classifyClaims(
      [claim("phase1:opp-1")],
      [ev("loc-1", "phase1_started", 3, "opp-1"), ev("loc-1", "phase1_complete", 1)],
      NOW,
    );

    expect(r.complete.map((c: { eventId: string }) => c.eventId)).toEqual(["opp-1"]);
    expect(r.stranded).toEqual([]);
  });

  it("calls a claim with a start and no finish STRANDED", () => {
    const r = classifyClaims(
      [claim("phase1:opp-2")],
      [ev("loc-2", "phase1_started", 3, "opp-2")],
      NOW,
    );

    expect(r.stranded).toHaveLength(1);
    expect(r.stranded[0]).toMatchObject({ eventId: "opp-2", locationId: "loc-2" });
  });

  it("does not let an EARLIER completion clear a LATER stranded claim", () => {
    // The forward-looking defect. Joining on location alone, a previous
    // successful run at the same location marks a genuinely stranded claim
    // COMPLETE — trading a visible gap for an invisible false negative.
    const r = classifyClaims(
      [claim("phase1:opp-3")],
      [
        ev("loc-3", "phase1_complete", 10), // an older run finished
        ev("loc-3", "phase1_started", 3, "opp-3"), // this one did not
      ],
      NOW,
    );

    expect(r.complete).toEqual([]);
    expect(r.stranded).toHaveLength(1);
  });

  it("reports a claim with no matching start under NO START", () => {
    const r = classifyClaims([claim("phase1:opp-missing")], [], NOW);

    expect(r.noStart.map((c: { eventId: string }) => c.eventId)).toEqual(["opp-missing"]);
  });

  it("puts a caller-supplied idempotency key in NO START, not in a finding bucket", () => {
    // `x-idempotency-key` is taken verbatim, so an arbitrary string reaches here
    // and is genuinely indistinguishable from a delivery that died before
    // logging. The script must not claim to tell them apart.
    const r = classifyClaims([claim("phase1:gh-redelivery-4412")], [], NOW);

    expect(r.noStart).toHaveLength(1);
    expect(r.unjoinable).toEqual([]);
  });

  it("computes age in hours from the claim timestamp", () => {
    const r = classifyClaims([claim("phase1:opp-4", 5)], [], NOW);

    expect(r.noStart[0].ageH).toBe("5.0");
  });
});

describe("classifyClaims — the sources that cannot be joined", () => {
  it("never classifies a phase2 claim as anything but unjoinable", () => {
    // phase2_started is never written, so no phase2 claim can ever be resolved.
    // Even handed a fabricated start, the source is not joinable at all.
    const r = classifyClaims(
      [claim(`phase2:${SHA}`), claim("phase2:some-key")],
      [ev("loc-9", "phase2_started", 3, "some-key")],
      NOW,
    );

    expect(r.unjoinable).toHaveLength(2);
    expect(r.stranded).toEqual([]);
    expect(r.complete).toEqual([]);
    expect(r.noStart).toEqual([]);
  });

  it("treats a phase3 content hash as unjoinable rather than as no-start", () => {
    const r = classifyClaims([claim(`phase3:${SHA}`)], [], NOW);

    expect(r.unjoinable).toHaveLength(1);
    expect(r.noStart).toEqual([]);
  });

  it("treats a phase1 content hash as unjoinable too", () => {
    const r = classifyClaims([claim(`phase1:${SHA}`)], [], NOW);

    expect(r.unjoinable).toHaveLength(1);
  });
});

describe("findOrphanStarts — the log side, independent of claim ids", () => {
  it("finds a phase3 start with no completion, which no claim id could reach", () => {
    const { orphans } = findOrphanStarts([ev("loc-5", "phase3_started", 4)]);

    expect(orphans).toHaveLength(1);
    expect(orphans[0]).toMatchObject({ source: "phase3", locationId: "loc-5" });
  });

  it("clears a phase3 start that has a later setup_guide_sent", () => {
    const { orphans } = findOrphanStarts([
      ev("loc-6", "phase3_started", 4),
      ev("loc-6", "phase3_setup_guide_sent", 1),
    ]);

    expect(orphans).toEqual([]);
  });

  it("does not clear a start using an earlier completion at the same location", () => {
    const { orphans } = findOrphanStarts([
      ev("loc-7", "phase3_setup_guide_sent", 10),
      ev("loc-7", "phase3_started", 2),
    ]);

    expect(orphans).toHaveLength(1);
  });

  it("looks for no phase2 start, because none is ever written", () => {
    const { orphans } = findOrphanStarts([ev("loc-8", "phase2_started", 4)]);

    expect(orphans).toEqual([]);
  });
});

describe("the ordering guard fails closed", () => {
  // An earlier version wrote the ordering as `ts === null || e.ts >= start.ts`,
  // so a MISSING timestamp skipped the requirement and reverted to the
  // locationId-only join — reinstating the exact false negative the check was
  // added to prevent, silently, in the most reassuring bucket there is.
  const missing = (which: "start" | "completion") =>
    classifyClaims(
      [claim("phase1:opp-x")],
      [
        ev("loc-x", "phase1_complete", which === "completion" ? null : 10),
        ev("loc-x", "phase1_started", which === "start" ? null : 3, "opp-x"),
      ],
      NOW,
    );

  it("does not call a claim COMPLETE when the completion has no timestamp", () => {
    const r = missing("completion");
    expect(r.complete).toEqual([]);
    expect(r.indeterminate).toHaveLength(1);
  });

  it("does not call a claim COMPLETE when the start has no timestamp", () => {
    const r = missing("start");
    expect(r.complete).toEqual([]);
    expect(r.indeterminate).toHaveLength(1);
  });

  it("still decides normally when both timestamps are present", () => {
    const r = classifyClaims(
      [claim("phase1:opp-y")],
      [ev("loc-y", "phase1_complete", 10), ev("loc-y", "phase1_started", 3, "opp-y")],
      NOW,
    );
    expect(r.stranded).toHaveLength(1);
    expect(r.indeterminate).toEqual([]);
  });

  it("applies the same rule on the log side", () => {
    const { orphans, indeterminate } = findOrphanStarts([
      ev("loc-z", "phase3_setup_guide_sent", null),
      ev("loc-z", "phase3_started", 3),
    ]);
    expect(orphans).toEqual([]);
    expect(indeterminate).toHaveLength(1);
  });
});

describe("distinctIncidents counts incidents, not rows", () => {
  it("does not count one phase1 stranding twice", () => {
    // phase1 is detected on BOTH sides, so summing the two lists double-counted
    // every phase1 stranding and printed it in both. Claim rows and start rows
    // are different units. AGENT_COORDINATION.md standing order 6.
    const events = [ev("loc-1", "phase1_started", 3, "opp-1")];
    const claims = classifyClaims([claim("phase1:opp-1")], events, NOW);
    const { orphans } = findOrphanStarts(events);

    expect(claims.stranded).toHaveLength(1);
    expect(orphans).toHaveLength(1); // same incident, other side

    const { count, orphansOnly } = distinctIncidents(claims, orphans);
    expect(count).toBe(1);
    expect(orphansOnly).toEqual([]);
  });

  it("still counts a log-side incident the claim side never saw", () => {
    // A phase3 start with no completion has no joinable claim, so the claim
    // side cannot see it. It must survive the dedupe.
    const events = [ev("loc-2", "phase3_started", 3)];
    const claims = classifyClaims([], events, NOW);
    const { orphans } = findOrphanStarts(events);

    expect(distinctIncidents(claims, orphans).count).toBe(1);
  });

  it("adds a claim-side and a log-side incident at different locations", () => {
    const events = [
      ev("loc-a", "phase1_started", 3, "opp-a"),
      ev("loc-b", "phase3_started", 3),
    ];
    const claims = classifyClaims([claim("phase1:opp-a")], events, NOW);
    const { orphans } = findOrphanStarts(events);

    expect(distinctIncidents(claims, orphans).count).toBe(2);
  });
});
