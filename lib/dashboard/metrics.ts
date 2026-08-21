import type { Role } from "@/lib/auth/roles";
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

export type Metric = {
  id: string;
  title: string;
  shape: Shape;
  /** Which hats may place a widget on this metric. Mirrors WidgetDefinition.availableFor. */
  availableFor: Role[];
  /**
   * The only data path. Takes the resolved scope, never a bare locationId —
   * that is what makes "forgot to filter" a type error instead of a leak.
   */
  fetch: (scope: ScopeFilter, period: Period) => Promise<MetricData>;
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
 * Metrics, added as each is migrated off the bundled widget ids.
 *
 * Empty on purpose at this commit: the enforcement layer lands first so that
 * every metric added after it is scoped by construction. Migrating the eleven
 * existing widgets is separate work with its own risk (saved dashboards
 * reference the old ids and must not be emptied).
 */
export const METRIC_REGISTRY: Record<string, Metric> = {};

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
