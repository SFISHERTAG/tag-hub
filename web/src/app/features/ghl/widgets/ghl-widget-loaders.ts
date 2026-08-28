import type { WidgetRegistryService } from '../../../shared/widgets/widget-registry.service';

/**
 * The widget ids this integration owns, and how to load each component.
 *
 * Registration is a function rather than a side effect at import time, because
 * `shared/widgets/widget-registry.service.ts` must never import a feature —
 * that is the rule that keeps the dashboard shell ignorant of what GHL is, and
 * eslint's `no-restricted-imports` enforces it. The composition root
 * (`web/src/app/widget-loaders.ts`, the one declared exemption) calls this.
 *
 * Every loader is a dynamic import, so a role whose layout contains none of
 * these widgets never downloads them.
 *
 * `docs/frontend-file-tree.md` assigns four ids to `ghl/widgets/`:
 * `pipeline_board`, `day_view`, `leads_funnel` and `owner_calendar`. All four
 * are registered. `team_performance` remains unregistered in
 * `clients/widgets/client-widget-loaders.ts` for a different reason — it has no
 * endpoint at all, so it is absent work rather than disconnected work, and its
 * "not built yet" tile is the honest state.
 */
export function registerGhlWidgets(registry: WidgetRegistryService): void {
  registry.registerLoader('leads_funnel', () =>
    import('./leads-funnel-widget/leads-funnel-widget').then((m) => m.LeadsFunnelWidget),
  );

  registry.registerLoader('day_view', () =>
    import('./day-view-widget/day-view-widget').then((m) => m.DayViewWidget),
  );

  registry.registerLoader('pipeline_board', () =>
    import('./pipeline-board-widget/pipeline-board-widget').then((m) => m.PipelineBoardWidget),
  );

  registry.registerLoader('owner_calendar', () =>
    import('./owner-calendar-widget/owner-calendar-widget').then((m) => m.OwnerCalendarWidget),
  );
}
