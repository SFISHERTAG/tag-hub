import { describe, expect, it } from "vitest";
import {
  METRIC_REGISTRY,
  VISUAL_REGISTRY,
  BUNDLED_WIDGET_METRICS,
  visualsFor,
  isValidInstance,
  scopedQuery,
  unsafeQueryForTests,
  type Metric,
  type MetricSource,
  type SourceQuery,
  type SourceRow,
} from "@/lib/dashboard/metrics";
import { resolveScope, unsafeScopeForTests } from "@/lib/dashboard/scope";
import type { Session } from "@/lib/auth/session";
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
      // unsafeQueryForTests, because the brand now stops the literal this
      // canary used to write — which is itself the fix working.
      const rows = await source.read(
        unsafeQueryForTests({
          dataset: "opportunities",
          locations: scope.locations,
          uids: "all",
          period,
          statuses: "any",
          timeframe: "in-period",
        }),
      );
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
    expect(
      scopedQuery("opportunities", scope, PERIOD, { statuses: ["open"], timeframe: "current" }),
    ).toEqual({
      dataset: "opportunities",
      locations: LOCATIONS,
      uids: ["user-a", "user-b"],
      period: PERIOD,
      statuses: ["open"],
      timeframe: "current",
    });
  });

  it("keeps a tenancy scope's 'all' rather than expanding it to a uid list", () => {
    const scope = unsafeScopeForTests("tenancy", LOCATIONS, "all");
    expect(
      scopedQuery("appointments", scope, PERIOD, { statuses: "any", timeframe: "in-period" }).uids,
    ).toBe("all");
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

/**
 * Stream-1 pins: the semantic constraints each metric must push down. These
 * are registry-driven like the scope assertions above, but the expectations
 * are per-metric because the right statuses are part of what the metric MEANS.
 */
describe("metrics constrain status and timeframe to match their names", () => {
  it("pipeline metrics ask for open deals only, as current state", async () => {
    for (const id of ["pipeline_open_value", "pipeline_by_stage"] as const) {
      const { source, queries } = recordingSource([row()]);
      await METRIC_REGISTRY[id].fetch(unsafeScopeForTests("tenancy", LOCATIONS, "all"), PERIOD, source);
      for (const query of queries) {
        expect(query.statuses, `${id} must not fetch closed deals`).toEqual(["open"]);
        expect(query.timeframe, `${id} is a stock, not a flow`).toBe("current");
      }
    }
  });

  it("appointments_booked excludes cancelled and invalid events", async () => {
    const { source, queries } = recordingSource([row()]);
    await METRIC_REGISTRY.appointments_booked.fetch(
      unsafeScopeForTests("tenancy", LOCATIONS, "all"),
      PERIOD,
      source,
    );
    for (const query of queries) {
      expect(query.statuses).not.toBe("any");
      expect(query.statuses).not.toContain("cancelled");
      expect(query.statuses).not.toContain("invalid");
      expect(query.statuses, "a no-show was still a booked appointment").toContain("noshow");
      expect(query.timeframe).toBe("in-period");
    }
  });
});

/**
 * The brand, and who may mint a query.
 *
 * ScopeFilter's unique-symbol brand made "forgot to filter" a type error, but
 * SourceQuery — the thing the adapter actually trusts — was a plain exported
 * type. Any server file could hand-write one with uids "all" and read through
 * createMetricSource without ever holding a ScopeFilter, which is the 7.6
 * guarantee stopping one layer above the data boundary.
 */
describe("SourceQuery is unforgeable", () => {
  it("a hand-written literal does not typecheck", () => {
    // @ts-expect-error — only scopedQuery (or the test constructor) may mint a SourceQuery
    const forged: SourceQuery = {
      dataset: "opportunities",
      locations: ["loc-a"],
      uids: "all",
      period: PERIOD,
      statuses: "any",
      timeframe: "in-period",
    };
    expect(forged.dataset).toBe("opportunities");
  });

  it("scopedQuery mints one that downstream accepts", () => {
    const scope = unsafeScopeForTests("tenancy", LOCATIONS, "all");
    const query = scopedQuery("opportunities", scope, PERIOD, {
      statuses: ["open"],
      timeframe: "current",
    });
    expect(query.locations).toEqual(LOCATIONS);
  });
});

/**
 * availableFor must only offer a metric to roles whose resolved scope the
 * adapter can serve. The review found all three metrics advertised to
 * client_closer (default scope "self") and client_manager ("team") while the
 * only real adapter throws UnsupportedScopeError for any uids !== "all" — a
 * closer placing "Open pipeline value" got a permanent error widget. Until
 * Story 7.8 lands the uid mapping, that means tenancy-resolving roles only,
 * and this test is what keeps the mismatch from recurring when roles or
 * datasets change.
 */
describe("availableFor offers metrics only to roles the adapter can serve", () => {
  function sessionFor(role: Session["currentRole"]): Session {
    return {
      uid: "user-x",
      email: "x@test",
      currentRole: role,
      availableRoles: [role],
      locations: [...LOCATIONS],
      // `grants` arrived on Session with story 15.A, after these review-stream
      // commits were written. Mirrors the fixture in test/scope-resolver.test.ts:
      // one grant for the role under test, scoped to the same locations the
      // session carries, so the adapter sees a consistent session rather than
      // one whose claim and resolved locations disagree.
      grants: [{ role, locations: [...LOCATIONS] }],
    };
  }

  for (const metric of Object.values(METRIC_REGISTRY)) {
    it(`${metric.id} is only offered where its fetch can succeed`, () => {
      for (const role of metric.availableFor) {
        const resolved = resolveScope(sessionFor(role));
        expect(
          resolved.uids,
          `${metric.id} is offered to ${role}, whose default scope the adapter refuses`,
        ).toBe("all");
      }
    });
  }
});
