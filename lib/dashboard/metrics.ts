import { ROLES, type Role } from "@/lib/auth/roles";
import type { ScopeFilter } from "./scope";

/**
 * Metric registry — what a number *is*, separated from how it is drawn.
 *
 * `WIDGET_REGISTRY` (widget-definitions.ts) bundles data and presentation into
 * one id: `spend_roas` is both "the ROAS figure" and "the way we draw ROAS".
 * That makes "show me ROAS as a bar instead" a new registry entry plus a new
 * branch in widget-grid's if-chain, so the chain grows with metrics × visuals.
 *
 * Here a metric declares its *shape* and nothing about appearance; a visual
 * declares which shapes it can draw; the pairing is checked rather than
 * enumerated. See docs/ROLE_SCOPE_MODEL.md.
 *
 * The other half of the file's job: `fetch` takes a `ScopeFilter`, which only
 * `resolveScope` can produce. There is deliberately no way to register a metric
 * that does not receive one — an unscoped metric has nowhere to exist.
 */

export type Shape = "scalar" | "timeseries" | "categorical" | "funnel" | "matrix";

export type Period = {
  /** Inclusive, epoch ms. */
  from: number;
  /** Exclusive, epoch ms. */
  to: number;
};

export type MetricData =
  | { shape: "scalar"; value: number; unit?: string }
  | { shape: "timeseries"; points: Array<{ t: number; value: number }> }
  | { shape: "categorical"; buckets: Array<{ label: string; value: number }> }
  | { shape: "funnel"; steps: Array<{ label: string; value: number }> }
  | { shape: "matrix"; rows: string[]; cols: string[]; cells: number[][] };

/**
 * The datasets a metric may read. Deliberately a closed list: a metric that
 * needs something not here is a conversation about the data model, not a
 * one-line addition at a call site.
 */
export type Dataset = "opportunities" | "appointments" | "ad_spend";

/**
 * One row, normalised across every dataset.
 *
 * The normalisation is what lets a single recording fake police the whole
 * registry in test/metric-scope.test.ts. It also puts the uid problem where it
 * cannot be missed: `ownerUid` is a Firebase uid, and GHL rows carry
 * `assignedTo`, a GHL user id. No mapping between those exists in this repo yet
 * (`users` holds sign-in identity only, and `Tenant.ownerGhlUserId` covers just
 * the tenant owner), so an adapter over GHL can only supply `null` here today.
 * A metric may therefore be location-scoped for real right now, and uid-scoped
 * only once that mapping exists.
 */
export type SourceRow = {
  readonly locationId: string;
  /** Firebase uid this row belongs to, or null when the dataset has no owner. */
  readonly ownerUid: string | null;
  /** Epoch ms the row is attributed to. */
  readonly at: number;
  /** The number this row contributes. */
  readonly value: number;
  /** Grouping label for categorical and funnel shapes; null for plain scalars. */
  readonly bucket: string | null;
};

/**
 * What a metric asks for. Carries the scope constraints explicitly rather than
 * letting a fetch narrow rows after the fact.
 *
 * Filtering inside the metric instead of here still produces the right number
 * today and is still a leak the moment a dataset grows past one page: what
 * escapes is the rows that crossed the boundary, not the rows that survived the
 * reduce. So the query is the unit the test inspects.
 */
declare const queryBrand: unique symbol;

export type SourceQuery = {
  readonly dataset: Dataset;
  readonly locations: readonly string[];
  readonly uids: readonly string[] | "all";
  readonly period: Period;
  /**
   * Which record statuses count. Required, not defaulted: "Open pipeline
   * value" once summed won, lost and abandoned deals because the fetch
   * defaulted to everything and nothing made the metric say otherwise. "any"
   * is the explicit opt-in for genuinely status-blind reads.
   */
  readonly statuses: readonly string[] | "any";
  /**
   * Whether the period selects events (rows dated inside it) or the metric is
   * a point-in-time stock the period does not slice. "Open pipeline value" is
   * a stock: filtering it by createdAt made still-open deals vanish once they
   * aged past the window.
   */
  readonly timeframe: "in-period" | "current";
  /**
   * Unforgeable for the same reason ScopeFilter is: the adapter trusts this
   * object, so a hand-written literal reaching it would be the cross-tenant
   * read the 7.6 brand exists to prevent — stopped one layer higher than the
   * data boundary is not stopped. `scopedQuery` is the only minter;
   * `unsafeQueryForTests` is the test-only escape hatch.
   */
  readonly [queryBrand]: "source-query";
};

/**
 * The one way a metric reaches data.
 *
 * A metric receives this rather than importing Firestore or Postgres directly,
 * which is the boundary eslint.config.mjs draws for lib/dashboard/** and
 * app/api/**, expressed as a type instead of a lint rule.
 */
export type MetricSource = {
  read(query: SourceQuery): Promise<readonly SourceRow[]>;
};

export type Metric = {
  id: string;
  title: string;
  shape: Shape;
  /** Which hats may place a widget on this metric. Mirrors WidgetDefinition.availableFor. */
  availableFor: Role[];
  /**
   * The only data path. Takes the resolved scope, never a bare locationId —
   * that is what makes "forgot to filter" a type error instead of a leak — and
   * reads through the injected source rather than querying directly, which is
   * what lets the registry test prove the scope was passed down rather than
   * merely accepted.
   */
  fetch: (scope: ScopeFilter, period: Period, source: MetricSource) => Promise<MetricData>;
};

export type Visual = {
  id: string;
  title: string;
  accepts: Shape[];
};

/**
 * A saved widget: a metric, a way of drawing it, and where it sits.
 * Replaces `WidgetPlacement.widgetId`'s bundled identity.
 */
export type WidgetInstance = {
  metricId: string;
  visualId: string;
};

export const VISUAL_REGISTRY: Record<string, Visual> = {
  number: { id: "number", title: "Number", accepts: ["scalar"] },
  sparkline: { id: "sparkline", title: "Sparkline", accepts: ["timeseries"] },
  line: { id: "line", title: "Line chart", accepts: ["timeseries"] },
  bar: { id: "bar", title: "Bar chart", accepts: ["categorical", "timeseries"] },
  donut: { id: "donut", title: "Donut", accepts: ["categorical"] },
  funnel: { id: "funnel", title: "Funnel", accepts: ["funnel"] },
  heatmap: { id: "heatmap", title: "Heat map", accepts: ["matrix"] },
  table: {
    id: "table",
    title: "Table",
    accepts: ["categorical", "timeseries", "funnel", "matrix"],
  },
};

/**
 * Builds the query for a scope, so a metric cannot compose one that drops a
 * constraint. Every registered metric goes through this rather than writing a
 * SourceQuery literal — the literal is what lets someone quietly pass
 * `uids: "all"` from a `self` scope.
 */
export function scopedQuery(
  dataset: Dataset,
  scope: ScopeFilter,
  period: Period,
  shape: { statuses: readonly string[] | "any"; timeframe: "in-period" | "current" },
): SourceQuery {
  return {
    dataset,
    locations: scope.locations,
    uids: scope.uids,
    period,
    statuses: shape.statuses,
    timeframe: shape.timeframe,
  } as SourceQuery;
}

/**
 * Test-only constructor, mirroring `unsafeScopeForTests`. The brand exists
 * precisely to stop application code building queries directly; tests for the
 * adapter need to, and this name is unmistakable at a call site.
 */
export function unsafeQueryForTests(query: Omit<SourceQuery, typeof queryBrand>): SourceQuery {
  return query as SourceQuery;
}

function sum(rows: readonly SourceRow[]): number {
  return rows.reduce((total, row) => total + row.value, 0);
}

function byBucket(rows: readonly SourceRow[]): Array<{ label: string; value: number }> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const label = row.bucket ?? "Unlabelled";
    totals.set(label, (totals.get(label) ?? 0) + row.value);
  }
  return Array.from(totals, ([label, value]) => ({ label, value }));
}

/**
 * Metrics, added as each is migrated off the bundled widget ids.
 *
 * These three are new, not migrations: they are the metric-shaped numbers the
 * registry makes expressible. No bundled widget is retired by them — see
 * BUNDLED_WIDGET_METRICS below for why none of the eleven has an equivalent.
 *
 * Every entry is scoped by construction (fetch cannot be written without a
 * ScopeFilter) and proven scoped by test/metric-scope.test.ts, which drives
 * itself off this object so a metric added tomorrow is covered today.
 */
export const METRIC_REGISTRY: Record<string, Metric> = {
  pipeline_open_value: {
    id: "pipeline_open_value",
    title: "Open pipeline value",
    shape: "scalar",
    // Tenancy-resolving roles only, until Story 7.8 lands the uid mapping:
    // client_closer and client_manager resolve to self/team scopes the adapter
    // refuses, so offering them this metric was offering a permanent error
    // widget. The registry test pins availableFor to what fetch can serve.
    availableFor: [ROLES.TAG_EXEC, ROLES.TAG_CSM],
    fetch: async (scope, period, source) => ({
      shape: "scalar",
      // Open deals only, as current state: the value of what is still in
      // play right now, not "deals created this period" (which excluded a
      // six-week-old live deal and included freshly created dead ones).
      value: sum(
        await source.read(
          scopedQuery("opportunities", scope, period, { statuses: ["open"], timeframe: "current" }),
        ),
      ),
      unit: "USD",
    }),
  },

  pipeline_by_stage: {
    id: "pipeline_by_stage",
    title: "Pipeline by stage",
    shape: "categorical",
    availableFor: [ROLES.TAG_EXEC, ROLES.TAG_CSM],
    fetch: async (scope, period, source) => ({
      shape: "categorical",
      buckets: byBucket(
        await source.read(
          scopedQuery("opportunities", scope, period, { statuses: ["open"], timeframe: "current" }),
        ),
      ),
    }),
  },

  appointments_booked: {
    id: "appointments_booked",
    title: "Appointments booked",
    shape: "scalar",
    availableFor: [ROLES.TAG_EXEC, ROLES.TAG_CSM],
    fetch: async (scope, period, source) => ({
      shape: "scalar",
      // "Booked" means it was scheduled and stayed scheduled: a no-show was
      // still a booked appointment, a cancelled or invalid one stopped being
      // one. Counting cancellations inflated this by exactly the events that
      // did not happen.
      value: (
        await source.read(
          scopedQuery("appointments", scope, period, {
            statuses: ["new", "confirmed", "showed", "noshow"],
            timeframe: "in-period",
          }),
        )
      ).length,
    }),
  },
};

/**
 * Bundled widget id to its (metric, visual) replacement.
 *
 * The compatibility map Story 7.6 asks for, so a saved dashboard referencing an
 * old id resolves rather than being emptied. `null` means the id has no metric
 * equivalent and keeps its bespoke component.
 *
 * Every entry is null today, and that is the honest answer rather than an
 * unfinished one. `Shape` covers numbers; a deal board, a day's schedule, a
 * client book, a team rollup, a department summary and a calendar are screens.
 * The three metrics above are new capabilities the registry makes possible, not
 * replacements for any of these: `appointments_booked` counts appointments and
 * `day_view` lists today's calls, and swapping one for the other would answer a
 * question nobody asked while looking like a migration.
 *
 * The map still earns its place. It names every bundled id, so a saved
 * dashboard cannot reference one nobody has ruled on, and the test below keeps
 * it in step with WIDGET_REGISTRY — a widget added without a decision recorded
 * here fails CI.
 */
export const BUNDLED_WIDGET_METRICS: Record<string, WidgetInstance | null> = {
  pipeline_board: null,
  kpi_summary: null,
  day_view: null,
  leads_funnel: null,
  spend_roas: null,
  client_health: null,
  portfolio: null,
  team_performance: null,
  team_health_rollup: null,
  department_overview: null,
  owner_calendar: null,
};

/** A visual can draw a metric only if it accepts that metric's shape. */
export function visualsFor(metric: Metric): Visual[] {
  return Object.values(VISUAL_REGISTRY).filter((v) => v.accepts.includes(metric.shape));
}

/** Metrics this hat may place. Availability only — scope decides content. */
export function metricsFor(role: Role): Metric[] {
  return Object.values(METRIC_REGISTRY).filter((m) => m.availableFor.includes(role));
}

/** Rejects a saved pairing that no longer typechecks against the registries. */
export function isValidInstance(instance: WidgetInstance): boolean {
  const metric = METRIC_REGISTRY[instance.metricId];
  const visual = VISUAL_REGISTRY[instance.visualId];
  if (!metric || !visual) return false;
  return visual.accepts.includes(metric.shape);
}
