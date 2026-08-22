import "server-only";
import type { MetricSource, SourceQuery, SourceRow } from "@/lib/dashboard/metrics";
import { getPipelines } from "@/lib/ghl/pipelines";
import { searchAllOpportunities, type OpportunityStatus } from "@/lib/ghl/opportunities";
import { getAppointments } from "@/lib/ghl/appointments";
import { getTenant } from "@/lib/ghl/tenants";
import { getAdSpendForRange } from "@/lib/meta/ads";

/**
 * The real `MetricSource`: the adapter that turns a scoped query into rows.
 *
 * Lives in lib/sources rather than lib/dashboard on purpose. The
 * `import/no-restricted-paths` zone in eslint.config.mjs bars lib/dashboard/**
 * and app/api/** from touching a database directly, and the point of that zone
 * is that dashboard code states *what* it wants while something else decides
 * *how* to get it. This is that something else, so it sits outside the zone and
 * needs no disable comment — unlike the six legacy fetchers, which are inside
 * it and carry one each precisely because they never made this separation.
 *
 * Every dependency is injected. The default wiring is the real lib/ghl and
 * lib/meta functions, and test/metric-source.test.ts substitutes fakes, so the
 * adapter's own behaviour is provable without a network or a GHL token.
 */

/**
 * Thrown when a query asks for scoping this adapter cannot honestly perform.
 *
 * The alternative is worse in both directions. Returning every row would be the
 * exact cross-user leak Story 7.6 exists to prevent. Returning no rows would be
 * indistinguishable from "this person genuinely has nothing", which is the
 * error-as-empty confusion the ApiResult contract already refuses elsewhere: a
 * closer would read a real zero off a dashboard that simply could not answer.
 * So it fails loudly and the caller renders an error state.
 */
export class UnsupportedScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedScopeError";
  }
}

/** The GHL and Meta surface this adapter needs, narrowed to what it calls. */
export type SourcePorts = {
  getPipelines: typeof getPipelines;
  getOpportunities: typeof searchAllOpportunities;
  getAppointments: typeof getAppointments;
  getTenant: typeof getTenant;
  getAdSpendForRange: typeof getAdSpendForRange;
};

const REAL_PORTS: SourcePorts = {
  getPipelines,
  getOpportunities: searchAllOpportunities,
  getAppointments,
  getTenant,
  getAdSpendForRange,
};

/**
 * Rejects a per-user query, because no uid-to-GHL-user mapping exists.
 *
 * `ScopeFilter.uids` holds Firebase uids. GHL rows carry `assignedTo` and
 * `assignedUserId`, which are GHL user ids from a different identity space.
 * `Tenant.ownerGhlUserId` maps exactly one person per tenant, and the `users`
 * collection holds sign-in identity only, so there is nothing to join on for
 * anybody else.
 *
 * That makes location scoping real today and uid scoping impossible, and this
 * is the line where that stops being an abstract caveat. When the mapping
 * lands, this function is what changes: resolve the uids to GHL user ids and
 * pass them down as a filter.
 */
function requireTenancyScope(query: SourceQuery): void {
  if (query.uids !== "all") {
    throw new UnsupportedScopeError(
      `Cannot scope ${query.dataset} to specific users: no mapping exists from Firebase uid ` +
        `to GHL user id, so this adapter cannot tell whose rows are whose. Widen the scope, ` +
        `or add the mapping (see SourceRow.ownerUid in lib/dashboard/metrics.ts).`,
    );
  }
}

/**
 * Thrown when upstream data cannot be represented honestly.
 *
 * A row whose timestamp does not parse used to become `at: NaN`, which every
 * period comparison rejects — so the row silently vanished from the sum. A
 * malformed record is an error, not a smaller number.
 */
export class SourceDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceDataError";
  }
}

function parseTimestamp(raw: string | undefined, describe: string): number {
  const parsed = Date.parse(raw ?? "");
  if (Number.isNaN(parsed)) {
    throw new SourceDataError(
      `${describe} has an unparseable timestamp (${JSON.stringify(raw ?? null)}). ` +
        `Dropping the row would silently understate the metric, so this fails instead.`,
    );
  }
  return parsed;
}

/** Rows whose timestamp falls inside the period. Inclusive from, exclusive to. */
function withinPeriod(rows: readonly SourceRow[], query: SourceQuery): readonly SourceRow[] {
  return rows.filter((row) => row.at >= query.period.from && row.at < query.period.to);
}

/** Applies the query's status constraint to rows bucketed by status. */
function matchesStatuses(status: string, statuses: readonly string[] | "any"): boolean {
  return statuses === "any" || statuses.includes(status);
}

async function readOpportunities(
  query: SourceQuery,
  ports: SourcePorts,
): Promise<readonly SourceRow[]> {
  const perLocation = await Promise.all(
    query.locations.map(async (locationId) => {
      const pipelines = await ports.getPipelines(locationId);

      // Stage names live on the pipeline, not the opportunity, so the lookup is
      // built once per location rather than per row.
      const stageNames = new Map<string, string>();
      for (const pipeline of pipelines) {
        for (const stage of pipeline.stages) stageNames.set(stage.id, stage.name);
      }

      // A single-status constraint is pushed down to the GHL query, so the
      // pagination budget is spent on rows the metric will keep — under
      // status "all" this location's dominant abandoned records could crowd
      // live deals out of every page. Multi-status (or "any") fetches all and
      // filters here.
      const single =
        query.statuses !== "any" && query.statuses.length === 1
          ? (query.statuses[0] as OpportunityStatus)
          : null;

      const perPipeline = await Promise.all(
        pipelines.map((pipeline) =>
          ports.getOpportunities(locationId, pipeline.id, { status: single ?? "all" }),
        ),
      );

      return perPipeline
        .flat()
        .filter((opportunity) => matchesStatuses(opportunity.status, query.statuses))
        .map<SourceRow>((opportunity) => ({
          locationId,
          // Always null: see requireTenancyScope. `opportunity.assignedTo` is a
          // GHL user id and is deliberately not passed off as a uid here — a
          // wrong join would silently attribute one person's deals to another.
          ownerUid: null,
          at: parseTimestamp(opportunity.createdAt, `Opportunity ${opportunity.id}`),
          value: opportunity.monetaryValue,
          bucket: stageNames.get(opportunity.pipelineStageId) ?? "Unknown stage",
        }));
    }),
  );

  return perLocation.flat();
}

async function readAppointments(
  query: SourceQuery,
  ports: SourcePorts,
): Promise<readonly SourceRow[]> {
  const perLocation = await Promise.all(
    query.locations.map(async (locationId) => {
      const appointments = await ports.getAppointments(locationId, {
        startMs: query.period.from,
        endMs: query.period.to,
      });

      return appointments
        .filter((appointment) => matchesStatuses(appointment.status, query.statuses))
        .map<SourceRow>((appointment) => ({
          locationId,
          ownerUid: null,
          at: parseTimestamp(appointment.startTime, `Appointment ${appointment.id}`),
          // One row is one appointment. Metrics that want a count take the row
          // count; a value of 1 keeps a sum meaning the same thing.
          value: 1,
          bucket: appointment.status,
        }));
    }),
  );

  return perLocation.flat();
}

async function readAdSpend(
  query: SourceQuery,
  ports: SourcePorts,
): Promise<readonly SourceRow[]> {
  // Resolve tenants first and dedupe by ad account. Two locations sharing one
  // metaAdAccountId (agency-managed accounts, or a copy-paste in the tenant
  // register) would otherwise each contribute the account's FULL spend, and a
  // tenancy-wide query would sum it twice. One account, one fetch, one set of
  // rows — attributed to the first location that names it.
  const tenants = await Promise.all(
    query.locations.map(async (locationId) => ({
      locationId,
      tenant: await ports.getTenant(locationId),
    })),
  );

  const byAccount = new Map<string, string>();
  for (const { locationId, tenant } of tenants) {
    // No ad account configured is a real "nothing to report", not a failure:
    // a tenant that runs no ads genuinely has no spend.
    if (tenant.metaAdAccountId && !byAccount.has(tenant.metaAdAccountId)) {
      byAccount.set(tenant.metaAdAccountId, locationId);
    }
  }

  const perAccount = await Promise.all(
    Array.from(byAccount, async ([accountId, locationId]) => {
      // The period travels as a position, not a length. The old shape passed
      // a day count to a fetch anchored at "now", so a query for last month
      // returned this month's spend relabelled.
      const spend = await ports.getAdSpendForRange(accountId, {
        fromMs: query.period.from,
        toMs: query.period.to,
      });

      return spend.map<SourceRow>((ad) => ({
        locationId,
        ownerUid: null,
        // Meta returns one total for the window, not a per-day series, so the
        // row is attributed to the start of the period. A timeseries metric
        // needs a daily breakdown from lib/meta before it can be honest.
        at: query.period.from,
        value: ad.spend,
        bucket: ad.adName,
      }));
    }),
  );

  return perAccount.flat();
}

/**
 * Builds the adapter.
 *
 * Pass `ports` to substitute the data layer; the default is the real one.
 */
export function createMetricSource(ports: SourcePorts = REAL_PORTS): MetricSource {
  return {
    async read(query: SourceQuery): Promise<readonly SourceRow[]> {
      requireTenancyScope(query);

      // An empty locations list means the session was granted no tenancy. That
      // is not "read everything" — returning [] here is the same fail-closed
      // position resolveScope takes one layer up.
      if (query.locations.length === 0) return [];

      // The period applies uniformly: "in-period" filters rows by their
      // timestamp, "current" means the metric is a point-in-time stock the
      // period does not slice. No dataset gets a bespoke exemption — the old
      // ad_spend special case was exactly the kind of per-case decision a new
      // dataset author would copy wrongly.
      const rows = await (() => {
        switch (query.dataset) {
          case "opportunities":
            return readOpportunities(query, ports);
          case "appointments":
            return readAppointments(query, ports);
          case "ad_spend":
            return readAdSpend(query, ports);
        }
      })();

      return query.timeframe === "in-period" ? withinPeriod(rows, query) : rows;
    },
  };
}
