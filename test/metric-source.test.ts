import { describe, expect, it, vi } from "vitest";
import {
  createMetricSource,
  UnsupportedScopeError,
  type SourcePorts,
} from "@/lib/sources/metric-source";
import { METRIC_REGISTRY, type SourceQuery } from "@/lib/dashboard/metrics";
import { unsafeScopeForTests } from "@/lib/dashboard/scope";

/**
 * The adapter is where Story 7.6's scope stops being a type and starts being a
 * query, so the tests are mostly about what it refuses to do.
 *
 * The one that matters: it cannot honour a per-user scope, because
 * `ScopeFilter.uids` are Firebase uids and GHL rows carry GHL user ids with no
 * mapping between them. There are two tempting ways to paper over that and both
 * are bugs. Returning every row is the cross-user leak the story exists to
 * prevent. Returning no rows reads as "you genuinely have nothing", which is the
 * error-as-empty confusion the ApiResult contract refuses elsewhere — a closer
 * would take a real zero off a dashboard that simply could not answer. So it
 * throws, and these tests pin that.
 */

const DAY = 86_400_000;
const PERIOD = { from: 1_000_000, to: 1_000_000 + DAY };

function query(overrides: Partial<SourceQuery> = {}): SourceQuery {
  return {
    dataset: "opportunities",
    locations: ["loc-a"],
    uids: "all",
    period: PERIOD,
    statuses: "any",
    timeframe: "in-period",
    ...overrides,
  };
}

function ports(overrides: Partial<SourcePorts> = {}): SourcePorts {
  return {
    getPipelines: vi.fn(async () => [
      { id: "pipe-1", name: "Sales", stages: [{ id: "st-1", name: "New", position: 0 }] },
    ]),
    getOpportunities: vi.fn(async (_loc: string, _pipe: string, options?: { status?: string }) => {
      const all = [
        {
          id: "opp-1",
          name: "Deal one",
          pipelineId: "pipe-1",
          pipelineStageId: "st-1",
          status: "open" as const,
          monetaryValue: 250,
          createdAt: new Date(PERIOD.from + 10).toISOString(),
          updatedAt: new Date(PERIOD.from + 10).toISOString(),
          assignedTo: "ghl-user-9",
        },
        {
          id: "opp-won",
          name: "Closed won",
          pipelineId: "pipe-1",
          pipelineStageId: "st-1",
          status: "won" as const,
          monetaryValue: 900,
          createdAt: new Date(PERIOD.from + 11).toISOString(),
          updatedAt: new Date(PERIOD.from + 11).toISOString(),
        },
        {
          id: "opp-dead",
          name: "Abandoned",
          pipelineId: "pipe-1",
          pipelineStageId: "st-1",
          status: "abandoned" as const,
          monetaryValue: 400,
          createdAt: new Date(PERIOD.from + 12).toISOString(),
          updatedAt: new Date(PERIOD.from + 12).toISOString(),
        },
      ];
      const status = options?.status ?? "open";
      return status === "all" ? all : all.filter((o) => o.status === status);
    }),
    getAppointments: vi.fn(async () => [
      {
        id: "appt-1",
        calendarId: "cal-1",
        assignedUserId: "ghl-user-9",
        startTime: new Date(PERIOD.from + 20).toISOString(),
        endTime: new Date(PERIOD.from + 30).toISOString(),
        status: "showed" as const,
      },
      {
        id: "appt-cancelled",
        calendarId: "cal-1",
        startTime: new Date(PERIOD.from + 40).toISOString(),
        endTime: new Date(PERIOD.from + 50).toISOString(),
        status: "cancelled" as const,
      },
      {
        id: "appt-noshow",
        calendarId: "cal-1",
        startTime: new Date(PERIOD.from + 60).toISOString(),
        endTime: new Date(PERIOD.from + 70).toISOString(),
        status: "noshow" as const,
      },
    ]),
    getTenant: vi.fn(async () => ({
      locationId: "loc-a",
      name: "Client A",
      services: {} as never,
      ownerModel: "client" as const,
      metaAdAccountId: "act_1",
    })),
    getAdSpendForRange: vi.fn(async () => [{ adId: "ad-1", adName: "Creative A", spend: 120 }]),
    ...overrides,
  } as SourcePorts;
}

describe("scope it cannot honour", () => {
  it("refuses a per-user query rather than answering it wrongly", async () => {
    const source = createMetricSource(ports());
    await expect(source.read(query({ uids: ["user-a"] }))).rejects.toBeInstanceOf(
      UnsupportedScopeError,
    );
  });

  it("names the missing mapping, so the next reader knows what would fix it", async () => {
    const source = createMetricSource(ports());
    await expect(source.read(query({ uids: ["user-a"] }))).rejects.toThrow(/uid[\s\S]*GHL user id/i);
  });

  it("does not reach the data layer at all on a scope it cannot honour", async () => {
    const p = ports();
    const source = createMetricSource(p);
    await source.read(query({ uids: ["user-a"] })).catch(() => undefined);
    expect(p.getPipelines).not.toHaveBeenCalled();
    expect(p.getOpportunities).not.toHaveBeenCalled();
  });

  it("reads nothing when the session was granted no tenancy", async () => {
    const p = ports();
    const source = createMetricSource(p);
    expect(await source.read(query({ locations: [] }))).toEqual([]);
    expect(p.getPipelines).not.toHaveBeenCalled();
  });
});

describe("opportunities", () => {
  it("labels each row with its stage name, not its stage id", async () => {
    const rows = await createMetricSource(ports()).read(query({ statuses: ["open"] }));
    expect(rows).toEqual([
      {
        locationId: "loc-a",
        ownerUid: null,
        at: PERIOD.from + 10,
        value: 250,
        bucket: "New",
      },
    ]);
  });

  it("falls back to a named unknown rather than an empty label", async () => {
    const rows = await createMetricSource(
      ports({ getPipelines: vi.fn(async () => [{ id: "pipe-1", name: "Sales", stages: [] }]) }),
    ).read(query());
    expect(rows[0].bucket).toBe("Unknown stage");
  });

  it("reads every granted location", async () => {
    const p = ports();
    await createMetricSource(p).read(query({ locations: ["loc-a", "loc-b"] }));
    expect(p.getPipelines).toHaveBeenCalledTimes(2);
  });

  it("drops rows outside the period", async () => {
    const rows = await createMetricSource(
      ports({
        getOpportunities: vi.fn(async () => [
          {
            id: "old",
            name: "Too old",
            pipelineId: "pipe-1",
            pipelineStageId: "st-1",
            status: "open" as const,
            monetaryValue: 10,
            createdAt: new Date(PERIOD.from - 1).toISOString(),
            updatedAt: new Date(PERIOD.from - 1).toISOString(),
          },
        ]),
      }),
    ).read(query());
    expect(rows).toEqual([]);
  });

  it("treats the period end as exclusive", async () => {
    const rows = await createMetricSource(
      ports({
        getOpportunities: vi.fn(async () => [
          {
            id: "edge",
            name: "On the boundary",
            pipelineId: "pipe-1",
            pipelineStageId: "st-1",
            status: "open" as const,
            monetaryValue: 10,
            createdAt: new Date(PERIOD.to).toISOString(),
            updatedAt: new Date(PERIOD.to).toISOString(),
          },
        ]),
      }),
    ).read(query());
    expect(rows).toEqual([]);
  });
});

describe("appointments", () => {
  it("counts one per appointment and keeps the status as the bucket", async () => {
    const rows = await createMetricSource(ports()).read(
      query({ dataset: "appointments", statuses: ["showed"] }),
    );
    expect(rows).toEqual([
      { locationId: "loc-a", ownerUid: null, at: PERIOD.from + 20, value: 1, bucket: "showed" },
    ]);
  });

  it("asks GHL for the period it was given", async () => {
    const p = ports();
    await createMetricSource(p).read(query({ dataset: "appointments" }));
    expect(p.getAppointments).toHaveBeenCalledWith("loc-a", {
      startMs: PERIOD.from,
      endMs: PERIOD.to,
    });
  });
});

describe("ad spend", () => {
  it("reports nothing for a tenant with no ad account, without calling Meta", async () => {
    const p = ports({
      getTenant: vi.fn(async () => ({
        locationId: "loc-a",
        name: "Client A",
        services: {} as never,
        ownerModel: "client" as const,
      })),
    });
    expect(await createMetricSource(p).read(query({ dataset: "ad_spend" }))).toEqual([]);
    expect(p.getAdSpendForRange).not.toHaveBeenCalled();
  });

  it("buckets spend by ad name", async () => {
    const rows = await createMetricSource(ports()).read(query({ dataset: "ad_spend" }));
    expect(rows).toEqual([
      { locationId: "loc-a", ownerUid: null, at: PERIOD.from, value: 120, bucket: "Creative A" },
    ]);
  });
});

describe("the uid join that does not exist", () => {
  it("never passes a GHL user id off as a Firebase uid", async () => {
    const source = createMetricSource(ports());
    for (const dataset of ["opportunities", "appointments", "ad_spend"] as const) {
      const rows = await source.read(query({ dataset }));
      for (const row of rows) {
        expect(row.ownerUid).toBeNull();
      }
    }
  });
});

/**
 * The chain end to end: a registered metric, the real adapter, fake ports.
 *
 * Each half is proven on its own above and in test/metric-scope.test.ts, and
 * neither proves they fit. This is the join — and it is also where the shape of
 * what works today is visible in one place: a tenancy scope produces real
 * numbers, and a self scope is refused rather than answered wrongly.
 */
describe("a registered metric through the real adapter", () => {
  const tenancy = unsafeScopeForTests("tenancy", ["loc-a"], "all");

  it("sums only OPEN deals into open pipeline value, never won or abandoned ones", async () => {
    // The fixture carries an open deal (250), a won one (900) and an abandoned
    // one (400) in the same stage. 1550 here means the metric is summing dead
    // and closed deals under the title "Open pipeline value".
    const source = createMetricSource(ports());
    const data = await METRIC_REGISTRY.pipeline_open_value.fetch(tenancy, PERIOD, source);
    expect(data).toEqual({ shape: "scalar", value: 250, unit: "USD" });
  });

  it("includes an open deal created before the period: open value is a stock, not a flow", async () => {
    const p = ports({
      getOpportunities: vi.fn(async () => [
        {
          id: "opp-old",
          name: "Old but live",
          pipelineId: "pipe-1",
          pipelineStageId: "st-1",
          status: "open" as const,
          monetaryValue: 5000,
          createdAt: new Date(PERIOD.from - 90 * 86_400_000).toISOString(),
          updatedAt: new Date(PERIOD.from - 90 * 86_400_000).toISOString(),
        },
      ]),
    });
    const data = await METRIC_REGISTRY.pipeline_open_value.fetch(tenancy, PERIOD, createMetricSource(p));
    expect(data).toEqual({ shape: "scalar", value: 5000, unit: "USD" });
  });

  it("groups pipeline by stage name", async () => {
    const source = createMetricSource(ports());
    const data = await METRIC_REGISTRY.pipeline_by_stage.fetch(tenancy, PERIOD, source);
    expect(data).toEqual({ shape: "categorical", buckets: [{ label: "New", value: 250 }] });
  });

  it("counts booked appointments, excluding cancelled and invalid but keeping no-shows", async () => {
    // A no-show WAS a booked appointment; a cancelled one stopped being one.
    // The fixture holds showed + cancelled + noshow, so the right answer is 2.
    const source = createMetricSource(ports());
    const data = await METRIC_REGISTRY.appointments_booked.fetch(tenancy, PERIOD, source);
    expect(data).toEqual({ shape: "scalar", value: 2 });
  });

  it("refuses every metric under a self scope, rather than one of them leaking", async () => {
    const source = createMetricSource(ports());
    const self = unsafeScopeForTests("self", ["loc-a"], ["user-a"]);
    for (const metric of Object.values(METRIC_REGISTRY)) {
      await expect(
        metric.fetch(self, PERIOD, source),
        `${metric.id} should refuse a scope the adapter cannot honour`,
      ).rejects.toBeInstanceOf(UnsupportedScopeError);
    }
  });
});

describe("ad spend honours the period's position, not just its length", () => {
  it("passes the query period itself to the range fetch", async () => {
    const p = ports();
    await createMetricSource(p).read(query({ dataset: "ad_spend" }));
    expect(p.getAdSpendForRange).toHaveBeenCalledWith("act_1", {
      fromMs: PERIOD.from,
      toMs: PERIOD.to,
    });
  });

  it("fetches a shared ad account once, not once per location", async () => {
    const sharedTenant = vi.fn(async (locationId: string) => ({
      locationId,
      name: `Client ${locationId}`,
      services: {} as never,
      ownerModel: "client" as const,
      metaAdAccountId: "act_shared",
    }));
    const p = ports({ getTenant: sharedTenant as never });
    const rows = await createMetricSource(p).read(
      query({ dataset: "ad_spend", locations: ["loc-a", "loc-b"] }),
    );
    expect(p.getAdSpendForRange).toHaveBeenCalledTimes(1);
    // The account's spend appears once in the sum, not once per location.
    expect(rows.reduce((t, r) => t + r.value, 0)).toBe(120);
  });
});

describe("a row with an unparseable timestamp fails loudly", () => {
  it("throws rather than silently dropping the row from the sum", async () => {
    const p = ports({
      getOpportunities: vi.fn(async () => [
        {
          id: "opp-bad-date",
          name: "No created date",
          pipelineId: "pipe-1",
          pipelineStageId: "st-1",
          status: "open" as const,
          monetaryValue: 10,
          createdAt: "not-a-date",
          updatedAt: "not-a-date",
        },
      ]),
    });
    await expect(createMetricSource(p).read(query({ statuses: ["open"] }))).rejects.toThrow(
      /opp-bad-date/,
    );
  });
});
