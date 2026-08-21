import type { DashboardConfig, WidgetDefinition } from '../../../shared/widgets/widget.model';

/**
 * The wire shape of `/api/dashboard/config`, mirrored from the route file.
 *
 * `DashboardConfig`, `DashboardPage`, `WidgetPlacement` and `WidgetDefinition`
 * are NOT redeclared here — they come from `shared/widgets/widget.model.ts`,
 * which is the client-side mirror of `lib/dashboard/widget-definitions.ts`. A
 * second copy in this feature would be a second thing to keep in sync with the
 * server, and the whole point of the registry living in shared/ is that there
 * is exactly one.
 */

export type FreshnessSource = 'appointment_outcome' | 'contact_added' | 'meta_fetch';

/**
 * The PRD's "as of" indicator. Both fields are null when no location resolves
 * or the freshness lookup failed — a missing timestamp is not an error worth
 * failing the dashboard over, but it must not render as "just now" either.
 */
export interface LastUpdated {
  readonly timestamp: number | null;
  readonly source: FreshnessSource | null;
}

export interface DashboardConfigResponse {
  /**
   * Already entitlement-filtered by the server. This never contains a widget
   * the current role may not use, even if the saved row does.
   */
  readonly config: DashboardConfig;
  /** Resolved from `?page=`, falling back to the saved current page. */
  readonly currentPageId: string | null;
  readonly availableWidgets: readonly WidgetDefinition[];
  /**
   * Widget ids dropped from the saved layout because this role no longer has
   * access to them.
   *
   * This is the visible end of the entitlement check. A layout saved while
   * someone held a role outlives that role, and the saved row is what drives
   * the next fetch — so the server strips those placements on read and names
   * them here. A dashboard that silently loses a tile teaches people the app is
   * flaky; one that says "Team Health was removed, your hat changed" does not.
   */
  readonly removedWidgetIds: readonly string[];
  /** Widget ids whose data is wholly or partly fabricated. */
  readonly sampleDataWidgetIds: readonly string[];
  /** Session-derived GHL location behind the location-scoped widgets, or null. */
  readonly locationId: string | null;
  readonly lastUpdated: LastUpdated;
}

export interface DashboardConfigSaveResponse {
  readonly ok: true;
  readonly config: DashboardConfig;
}
