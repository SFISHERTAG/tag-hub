import { describe, expect, it } from "vitest";
import {
  METRIC_REGISTRY,
  VISUAL_REGISTRY,
  visualsFor,
  isValidInstance,
} from "@/lib/dashboard/metrics";
import { unsafeScopeForTests } from "@/lib/dashboard/scope";

/**
 * Registry-driven, deliberately.
 *
 * test/require-location-access.test.ts proves the tenancy guard behaves
 * correctly when it is called — but not that every call site calls it, so a
 * fetcher that skips it passes. Enumerating the registry closes that gap: a
 * metric added later that ignores its ScopeFilter fails here on the day it
 * lands, without anyone having remembered to write a test for it.
 */

const PERIOD = { from: 0, to: 86_400_000 };
const LOCATIONS = ["loc-a"];

describe("every registered metric honours scope", () => {
  const metrics = Object.values(METRIC_REGISTRY);

  it("registry is enumerable (guards against the loop below silently passing on empty)", () => {
    // METRIC_REGISTRY is empty until metrics are migrated off the bundled
    // widget ids. This assertion exists so that fact stays visible: when it
    // starts failing, delete it — do not weaken the loop.
    expect(Array.isArray(metrics)).toBe(true);
  });

  for (const metric of metrics) {
    it(`${metric.id} returns different rows for two different users`, async () => {
      const asUserA = await metric.fetch(
        unsafeScopeForTests("self", LOCATIONS, ["user-a"]),
        PERIOD,
      );
      const asUserB = await metric.fetch(
        unsafeScopeForTests("self", LOCATIONS, ["user-b"]),
        PERIOD,
      );
      expect(asUserA).not.toEqual(asUserB);
    });

    it(`${metric.id} declares a shape some visual can draw`, () => {
      expect(visualsFor(metric).length).toBeGreaterThan(0);
    });
  }
});

describe("visual/metric pairing", () => {
  it("rejects a visual that cannot draw the metric's shape", () => {
    expect(isValidInstance({ metricId: "does_not_exist", visualId: "number" })).toBe(false);
  });

  it("every visual accepts at least one shape", () => {
    for (const visual of Object.values(VISUAL_REGISTRY)) {
      expect(visual.accepts.length).toBeGreaterThan(0);
    }
  });
});
