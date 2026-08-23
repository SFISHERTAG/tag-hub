import { describe, expect, it } from "vitest";
import {
  FULFILLMENT_STAGE_ORDER,
  STAGE_TASKS,
  isFulfillmentStage,
  parseFulfillmentStage,
  type FulfillmentStage,
} from "./stage-tasks";

/**
 * Story 5.1 / the 2026-08-22 GHL stage rename.
 *
 * The rename broke `parseFulfillmentStage` in production while every existing
 * test stayed green, because the fixtures were written against the PR1-AP5
 * names and never touched a real GHL stage string. That is the failure this
 * file exists to prevent, so LIVE_GHL_STAGE_NAMES below is a verbatim
 * transcription of the Fulfillment pipeline as it stands in GHL, typo
 * included. When someone renames a stage again, this is what should go red.
 */

/** Verbatim from the GHL Fulfillment pipeline, in board order. */
const LIVE_GHL_STAGE_NAMES: ReadonlyArray<readonly [string, FulfillmentStage]> = [
  ["Onboarding Booked", "OB"],
  ["Onboarding Complete", "OC"],
  ["Tech Stack Provisioned", "TP"],
  ["Intake Complete", "IC"],
  ["Creative Copy Complete", "CC"],
  ["Creatives Compete", "CR"], // GHL's own typo. Do not "fix" without renaming the stage in GHL first.
  ["Editing Complete", "EC"],
  ["Campaign Launched", "CL"],
  ["First Appointment Booked", "FA"],
  ["1st Deal Closed", "DC"],
  ["Ascension", "AS"],
  ["Offboarded", "OFF"],
];

describe("parseFulfillmentStage — live GHL stage names", () => {
  it.each(LIVE_GHL_STAGE_NAMES)("parses %j to %s", (name, code) => {
    expect(parseFulfillmentStage(name)).toBe(code);
  });

  it("covers every stage on the live board", () => {
    expect(LIVE_GHL_STAGE_NAMES).toHaveLength(12);
  });

  it("maps each live stage to a distinct code", () => {
    const codes = LIVE_GHL_STAGE_NAMES.map(([, code]) => code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("accepts the corrected spelling of the typo'd stage", () => {
    // Tolerated so the parser survives GHL fixing its own typo unannounced.
    expect(parseFulfillmentStage("Creatives Complete")).toBe("CR");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(parseFulfillmentStage("  campaign LAUNCHED  ")).toBe("CL");
  });
});

describe("parseFulfillmentStage — legacy PR/AP names", () => {
  it.each([
    ["AP 2 - Ads Launched", "AP2"],
    ["PR 1 - Kickoff", "PR1"],
    ["PR1", "PR1"],
    ["ap2", "AP2"],
    ["AP.3 - Post launch", "AP3"],
    ["AP—4", "AP4"],
  ] as const)("parses %j to %s", (name, code) => {
    expect(parseFulfillmentStage(name)).toBe(code);
  });
});

describe("parseFulfillmentStage — bare codes", () => {
  it.each(FULFILLMENT_STAGE_ORDER)("round-trips %s", (code) => {
    expect(parseFulfillmentStage(code)).toBe(code);
  });
});

describe("parseFulfillmentStage — non-stages", () => {
  const NON_STAGES: ReadonlyArray<readonly [string | null | undefined, string]> = [
    [null, "null"],
    [undefined, "undefined"],
    ["", "empty string"],
    ["   ", "whitespace only"],
    ["Sales Qualified", "an unrelated pipeline stage"],
    ["AP9", "an out-of-range AP code"],
    ["PR0", "a zero code"],
    ["Follow up on AP2 next week", "a name that merely mentions a code"],
  ];

  it.each(NON_STAGES)("returns null for %j (%s)", (input) => {
    expect(parseFulfillmentStage(input)).toBeNull();
  });
});

describe("stage model parity", () => {
  it("gives every stage a task list", () => {
    const missing = FULFILLMENT_STAGE_ORDER.filter((s) => !(s in STAGE_TASKS));
    expect(missing).toEqual([]);
  });

  it("declares no task list for a stage that is not in the order", () => {
    const orphans = Object.keys(STAGE_TASKS).filter(
      (k) => !isFulfillmentStage(k),
    );
    expect(orphans).toEqual([]);
  });

  it("uses unique task ids across every stage", () => {
    const ids = Object.values(STAGE_TASKS).flatMap((t) => t.map((x) => x.id));
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });
});
