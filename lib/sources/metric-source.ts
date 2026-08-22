import "server-only";
import type { MetricSource, SourceQuery, SourceRow } from "@/lib/dashboard/metrics";
import { getPipelines } from "@/lib/ghl/pipelines";
import { getOpportunities } from "@/lib/ghl/opportunities";
import { getAppointments } from "@/lib/ghl/appointments";
import { getTenant } from "@/lib/ghl/tenants";
import { getAdSpend } from "@/lib/meta/ads";

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
  getOpportunities: typeof getOpportunities;
  getAppointments: typeof getAppointments;
  getTenant: typeof getTenant;
  getAdSpend: typeof getAdSpend;
};

const REAL_PORTS: SourcePorts = {
  getPipelines,
  getOpportunities,
  getAppointments,
  getTenant,
  getAdSpend,
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

/** Rows whose timestamp falls inside the period. Inclusive from, exclusive to. */
function withinPeriod(rows: readonly SourceRow[], query: SourceQuery): readonly SourceRow[] {
  return rows.filter((row) => row.at >= query.period.from && row.at < query.period.to);
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

      const perPipeline = await Promise.all(
        pipelines.map((pipeline) =>
          ports.getOpportunities(locationId, pipeline.id, { status: "all" }),
        ),
      );

      return perPipeline.flat().map<SourceRow>((opportunity) => ({
        locationId,
        // Always null: see requireTenancyScope. `opportunity.assignedTo` is a
        // GHL user id and is deliberately not passed off as a uid here — a
        // wrong join would silently attribute one person's deals to another.
        ownerUid: null,
        at: Date.parse(opportunity.createdAt),
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

      return appointments.map<SourceRow>((appointment) => ({
        locationId,
        ownerUid: null,
        at: Date.parse(appointment.startTime),
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
  const days = Math.max(1, Math.ceil((query.period.to - query.period.from) / 86_400_000));

  const perLocation = await Promise.all(
    query.locations.map(async (locationId) => {
      const tenant = await ports.getTenant(locationId);
      // No ad account configured is a real "nothing to report", not a failure:
      // getAdSpend already returns [] when Meta is unconfigured, and a tenant
      // that runs no ads genuinely has no spend.
      if (!tenant.metaAdAccountId) return [];

      const spend = await ports.getAdSpend(tenant.metaAdAccountId, days);

      return spend.map<SourceRow>((ad) => ({
        locationId,
        ownerUid: null,
        // Meta returns a spend total for the window, not a per-day series, so
        // every row is attributed to the start of the period. A timeseries
        // metric needs a daily breakdown from lib/meta before it can be honest.
        at: query.period.from,
        value: ad.spend,
        bucket: ad.adName,
      }));
    }),
  );

  return perLocation.flat();
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

      switch (query.dataset) {
        case "opportunities":
          return withinPeriod(await readOpportunities(query, ports), query);
        case "appointments":
          // Already fetched by range; filtering again costs nothing and keeps
          // the period contract true regardless of what GHL returns.
          return withinPeriod(await readAppointments(query, ports), query);
        case "ad_spend":
          return readAdSpend(query, ports);
      }
    },
  };
}
