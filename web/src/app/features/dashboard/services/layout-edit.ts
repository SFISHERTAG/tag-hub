import type {
  DashboardConfig,
  DashboardPage,
  WidgetDefinition,
  WidgetPlacement,
} from '../../../shared/widgets/widget.model';

/**
 * Every edit the customize screen can make to a layout, as pure functions.
 *
 * Separated from the component for one reason: these are the rules that decide
 * what gets PUT to the server, and the server rejects an out-of-range size with
 * a 400. Testing them through a rendered component would mean testing the
 * clamps through three layers of Material buttons; testing them here is direct,
 * and the component keeps no logic worth hiding.
 *
 * Nothing here mutates its input. A layout is state the screen holds in a
 * signal, and an in-place edit would change what is displayed before the save
 * that justifies it has succeeded.
 */

/**
 * The server's own bounds, from the `cols`/`rows` validation in
 * `PUT /api/dashboard/config`: integers 1 to 4 on both axes. The reference
 * implementation clamped rows at 3 in the UI while the endpoint accepted 4,
 * which is a control that refuses a value the API would have taken. These match
 * the endpoint, so the only thing that can refuse a size is the endpoint.
 */
export const MIN_COLS = 1;
export const MAX_COLS = 4;
export const MIN_ROWS = 1;
export const MAX_ROWS = 4;

export type SizeAxis = 'cols' | 'rows';

/** Replaces one page inside a config, leaving everything else alone. */
export function withPage(config: DashboardConfig, page: DashboardPage): DashboardConfig {
  return {
    ...config,
    pages: config.pages.map((existing) => (existing.id === page.id ? page : existing)),
  };
}

export function withWidgets(page: DashboardPage, widgets: WidgetPlacement[]): DashboardPage {
  return { ...page, widgets };
}

/**
 * Adds or removes a widget.
 *
 * The placement id is the widget id, not a generated one. A page holds at most
 * one placement per widget because this function toggles, so the widget id is
 * already unique within the page — and the clock-based suffix it replaces was a
 * render-purity violation as well as unnecessary: the id is persisted, so
 * saving the same layout twice produced two different ids and a diff where
 * there was no change.
 *
 * An unknown widget id is a no-op rather than an error. The picker only offers
 * what the server said is available, so this can only be reached by a stale
 * list, and dropping a click is better than throwing inside an event handler.
 */
export function toggleWidget(
  page: DashboardPage,
  widgetId: string,
  available: readonly WidgetDefinition[],
): DashboardPage {
  const active = page.widgets.some((placement) => placement.widgetId === widgetId);

  if (active) {
    return withWidgets(
      page,
      page.widgets.filter((placement) => placement.widgetId !== widgetId),
    );
  }

  const definition = available.find((widget) => widget.id === widgetId);
  if (!definition) return page;

  return withWidgets(page, [
    ...page.widgets,
    {
      id: widgetId,
      widgetId,
      position: { x: 0, y: 0 },
      size: clampSize(definition.defaultSize),
    },
  ]);
}

/** Swaps a placement with its neighbour. Out-of-range moves are a no-op. */
export function moveWidget(page: DashboardPage, index: number, delta: -1 | 1): DashboardPage {
  const target = index + delta;
  if (index < 0 || index >= page.widgets.length) return page;
  if (target < 0 || target >= page.widgets.length) return page;

  const widgets = [...page.widgets];
  const moved = widgets[index];
  const displaced = widgets[target];
  if (!moved || !displaced) return page;

  widgets[index] = displaced;
  widgets[target] = moved;

  return withWidgets(page, widgets);
}

/**
 * Grows or shrinks a placement on one axis, clamped to the server's bounds.
 *
 * A change that would leave the range is a no-op rather than a clamped save:
 * the button is already disabled at the limit, so reaching here means something
 * else called it, and silently saving "the same thing again" would produce a
 * PUT that looks like an edit.
 */
export function resizeWidget(
  page: DashboardPage,
  index: number,
  axis: SizeAxis,
  delta: 1 | -1,
): DashboardPage {
  const placement = page.widgets[index];
  if (!placement) return page;

  const next = placement.size[axis] + delta;
  const min = axis === 'cols' ? MIN_COLS : MIN_ROWS;
  const max = axis === 'cols' ? MAX_COLS : MAX_ROWS;
  if (next < min || next > max) return page;

  return withWidgets(
    page,
    page.widgets.map((existing, i) =>
      i === index ? { ...existing, size: { ...existing.size, [axis]: next } } : existing,
    ),
  );
}

export function canGrow(placement: WidgetPlacement, axis: SizeAxis): boolean {
  return placement.size[axis] < (axis === 'cols' ? MAX_COLS : MAX_ROWS);
}

export function canShrink(placement: WidgetPlacement, axis: SizeAxis): boolean {
  return placement.size[axis] > (axis === 'cols' ? MIN_COLS : MIN_ROWS);
}

/**
 * A widget's declared default size, brought inside the server's bounds.
 *
 * `kpi_summary` and `owner_calendar` declare `cols: 4`, which is the maximum
 * and fine; this exists so a registry entry that ever declared 5 could not
 * produce a layout the endpoint refuses to save, with the failure landing on
 * whoever clicked the picker rather than on whoever wrote the registry.
 */
function clampSize(size: { cols: number; rows: number }): { cols: number; rows: number } {
  return {
    cols: clamp(size.cols, MIN_COLS, MAX_COLS),
    rows: clamp(size.rows, MIN_ROWS, MAX_ROWS),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
