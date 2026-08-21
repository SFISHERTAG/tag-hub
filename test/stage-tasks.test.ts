import { describe, expect, it } from "vitest";
import { parseFulfillmentStage, STAGE_TASKS } from "@/lib/onboarding/stage-tasks";

/**
 * Resweep High finding: the stage matcher wanted an exact `"AP2"`, and GHL's
 * real stage names carry a label after the code. This codebase's own
 * `AP2_STAGE_NAME` constant spells one out as "AP 2 - Ads Launched", so the
 * exact match never matched and every client past PR1 saw "Stage
 * unrecognized" with an empty checklist instead of their tasks.
 */

describe("parseFulfillmentStage", () => {
  it("matches GHL's real stage-name format", () => {
    expect(parseFulfillmentStage("AP 2 - Ads Launched")).toBe("AP2");
    expect(parseFulfillmentStage("PR 1 - Kickoff")).toBe("PR1");
    expect(parseFulfillmentStage("AP5 — Ascension")).toBe("AP5");
  });

  it("still matches a bare code", () => {
    expect(parseFulfillmentStage("AP2")).toBe("AP2");
    expect(parseFulfillmentStage("PR1")).toBe("PR1");
  });

  it("is case-insensitive on the prefix", () => {
    expect(parseFulfillmentStage("ap 3 - Review")).toBe("AP3");
  });

  it("returns null for stages outside the Fulfillment pipeline", () => {
    expect(parseFulfillmentStage("Appointment Scheduled")).toBeNull();
    expect(parseFulfillmentStage("Closed Won")).toBeNull();
    expect(parseFulfillmentStage("")).toBeNull();
    expect(parseFulfillmentStage(null)).toBeNull();
  });

  it("does not match a code buried mid-name", () => {
    // Anchored at the start, so a Sales stage that merely mentions AP2 in its
    // description cannot masquerade as a Fulfillment stage.
    expect(parseFulfillmentStage("Follow up after AP2")).toBeNull();
  });

  it("returns null for a code outside the known range", () => {
    expect(parseFulfillmentStage("AP9 - Nonexistent")).toBeNull();
    expect(parseFulfillmentStage("PR3 - Nonexistent")).toBeNull();
  });

  it("every parsed stage has a task list", () => {
    for (const name of ["PR 1 - x", "PR 2 - x", "AP 1 - x", "AP 2 - x", "AP 3 - x", "AP 4 - x", "AP 5 - x"]) {
      const stage = parseFulfillmentStage(name);
      expect(stage).not.toBeNull();
      expect(STAGE_TASKS[stage!].length).toBeGreaterThan(0);
    }
  });
});
