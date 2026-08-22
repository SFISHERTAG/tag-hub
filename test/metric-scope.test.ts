import { describe, expect, it } from "vitest";
import {
  METRIC_REGISTRY,
  VISUAL_REGISTRY,
  BUNDLED_WIDGET_METRICS,
  visualsFor,
  isValidInstance,
  scopedQuery,
  type Metric,
  type MetricSource,
  type SourceQuery,
  type SourceRow,
} from "@/lib/dashboard/metrics";
import { unsafeScopeForTests } from "@/lib/dashboard/scope";
import { ROLES } from "@/lib/auth/roles";

/**
 * Registry-driven, deliberately.
 *
 * test/require-location-access.test.ts proves the tenancy guard behaves
 * correctly when it is called, but not that every call site calls it. Driving
 * off METRIC_REGISTRY closes that gap: a metric added tomorrow is covered
 * today, without anyone remembering to write this.
 *
 * What changed, and why the earlier version of this file could never pass.
 * It asserted that two different uids get different results, then called each
 * metric's real fetch to find out. That demanded uid-variance from every
 * metric, which is false for a legitimately tenancy-wide one — a department
 * total *should* read the same for two execs in one tenancy — and it meant the
 * first metric ever registered failed here. It also would have driven real
 * network I/O from a unit suite as soon as a metric had a live data path.
 *
 * The property actually worth policing is narrower and provable: a metric must
 * push the scope it was handed down to the data layer, rather than fetching
 * wide and filtering afterwards. Those two produce the same number today and
 * differ completely the moment a dataset outgrows one page, because what leaks
 * is the rows that crossed the boundary, not the rows that survived the reduce.
 * So the fake below records every query and the assertions read the query.
 */

const PERIOD = { from: 0, to: 86_400_000 };
const LOCATIONS = ["loc-a", "loc-b"];

function recordingSource(rows: readonly SourceRow[] = []): {
  source: MetricSource;
  queries: SourceQuery[];
} {
  const queries: SourceQuery[] = [];
  return {
    queries,
    source: {
      read: async (query) => {
        queries.push(query);
        return rows;
      },
    },
  };
}

function row(overrides: Partial<SourceRow> = {}): SourceRow {
  return { locationId: "loc-a", ownerUid: "user-a", at: 1_000, value: 10, bucket: "New", ...overrides };
}

describe("every registered metric pushes its scope to the data layer", () => {
  const metrics = Object.values(METRIC_REGISTRY);

  it("registry is not empty, or the loop below asserts nothing", () => {
    expect(metrics.length).toBeGreaterThan(0);
  });

  for (const metric of metrics) {
    describe(metric.id, () => {
      it("reads through the injected source rather than querying directly", async () => {
        const { source, queries } = recordingSource([row()]);
        await metric.fetch(unsafeScopeForTests("self", LOCATIONS, ["user-a"]), PERIOD, source);
        expect(queries.length).toBeGreaterThan(0);
      });

      it("carries the caller's locations on every query", async () => {
        const { source, queries } = recordingSource([row()]);
        await metric.fetch(unsafeScopeForTests("self", LOCATIONS, ["user-a"]), PERIOD, source);
        for (const query of queries) {
          expect(query.locations).toEqual(LOCATIONS);
        }
      });

      it("carries the caller's uids on every query, so a self scope cannot read the tenancy", async () => {
        const { source, queries } = recordingSource([row()]);
        await metric.fetch(unsafeScopeForTests("self", LOCATIONS, ["user-a"]), PERIOD, source);
        for (const query of queries) {
          expect(query.uids).toEqual(["user-a"]);
        }
      });

      it("does not widen a self scope to the whole tenancy", async () => {
        const { source, queries } = recordingSource([row()]);
        await metric.fetch(unsafeScopeForTests("self", LOCATIONS, ["user-a"]), PERIOD, source);
        for (const query of queries) {
          expect(query.uids).not.toBe("all");
        }
      });

      it("passes the period through untouched", async () => {
        const { source, queries } = recordingSource([row()]);
        await metric.fetch(unsafeScopeForTests("tenancy", LOCATIONS, "all"), PERIOD, source);
        for (const query of queries) {
          expect(query.period).toEqual(PERIOD);
        }
      });

      it("returns the shape it declares", async () => {
        const { source } = recordingSource([row()]);
        const data = await metric.fetch(
          unsafeScopeForTests("tenancy", LOCATIONS, "all"),
          PERIOD,
          source,
        );
        expect(data.shape).toBe(metric.shape);
      });

      it("declares a shape some visual can draw", () => {
        expect(visualsFor(metric).length).toBeGreaterThan(0);
      });
    });
  }
});

/**
 * The canary. A guard nobody has seen fail is a guard nobody knows works, and
 * this one is the whole point of the file — so a metric that fetches wide and
 * filters afterwards is written here on purpose and shown to be caught.
 */
describe("the guard catches a metric that ignores its filter", () => {
  const leaky: Metric = {
    id: "leaky",
    title: "Fetches the tenancy and narrows afterwards",
    shape: "scalar",
    availableFor: [ROLES.TAG_EXEC],
    fetch: async (scope, period, source) => {
      // The bug this file exists to catch: reads everything, then filters in
      // memory. Returns the right number and leaked every other row to get it.
      const rows = await source.read({
        dataset: "opportunities",
        locations: scope.locations,
        uids: "all",
        period,
      });
      const mine = scope.uids === "all" ? rows : rows.filter((r) => scope.uids.includes(r.ownerUid ?? ""));
      return { shape: "scalar", value: mine.reduce((t, r) => t + r.value, 0) };
    },
  };

  it("returns a correct-looking number, which is why this is easy to miss", async () => {
    const { source } = recordingSource([row({ ownerUid: "user-a" }), row({ ownerUid: "user-b" })]);
    const data = await leaky.fetch(unsafeScopeForTests("self", LOCATIONS, ["user-a"]), PERIOD, source);
    expect(data).toEqual({ shape: "scalar", value: 10 });
  });

  it("is caught anyway, because the query it sent asked for everyone", async () => {
    const { source, queries } = recordingSource([row()]);
    await leaky.fetch(unsafeScopeForTests("self", LOCATIONS, ["user-a"]), PERIOD, source);
    expect(queries.every((q) => q.uids !== "all")).toBe(false);
  });
});

describe("scopedQuery", () => {
  it("copies the scope's constraints verbatim", () => {
    const scope = unsafeScopeForTests("team", LOCATIONS, ["user-a", "user-b"]);
    expect(scopedQuery("opportunities", scope, PERIOD)).toEqual({
      dataset: "opportunities",
      locations: LOCATIONS,
      uids: ["user-a", "user-b"],
      period: PERIOD,
    });
  });

  it("keeps a tenancy scope's 'all' rather than expanding it to a uid list", () => {
    const scope = unsafeScopeForTests("tenancy", LOCATIONS, "all");
    expect(scopedQuery("appointments", scope, PERIOD).uids).toBe("all");
  });
});

describe("visual/metric pairing", () => {
  it("rejects a saved pairing that no longer typechecks", () => {
    expect(isValidInstance({ metricId: "does_not_exist", visualId: "number" })).toBe(false);
  });

  it("every visual accepts at least one shape", () => {
    for (const visual of Object.values(VISUAL_REGISTRY)) {
      expect(visual.accepts.length).toBeGreaterThan(0);
    }
  });
});

describe("bundled widget compatibility map", () => {
  it("names every bundled widget id, so a saved dashboard cannot hit an unknown one", async () => {
    const { WIDGET_REGISTRY } = await import("@/lib/dashboard/widget-definitions");
    expect(Object.keys(BUNDLED_WIDGET_METRICS).sort()).toEqual(Object.keys(WIDGET_REGISTRY).sort());
  });

  it("every mapped pairing is one the registries actually accept", () => {
    for (const [widgetId, instance] of Object.entries(BUNDLED_WIDGET_METRICS)) {
      if (instance === null) continue;
      expect(isValidInstance(instance), `${widgetId} maps to an invalid pairing`).toBe(true);
    }
  });
});
