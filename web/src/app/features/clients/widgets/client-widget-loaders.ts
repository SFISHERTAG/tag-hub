import type { WidgetRegistryService } from '../../../shared/widgets/widget-registry.service';

/**
 * The four widget ids this feature owns, and how to load each component.
 *
 * Registration is a function rather than a side effect at import time, because
 * `shared/widgets/widget-registry.service.ts` must never import a feature —
 * that is the rule that keeps the dashboard shell ignorant of what a client is,
 * and eslint's `no-restricted-imports` enforces it. The composition root
 * (`web/src/app/widget-loaders.ts`, the one declared exemption) calls this.
 *
 * Every loader is a dynamic import, so a role whose layout contains none of
 * these widgets never downloads them.
 *
 * `team_performance` is in the shared registry and in the target file tree for
 * this feature, and it is deliberately NOT here: there is no
 * `/api/dashboard/widgets/team-performance` endpoint and no port of its data.
 * An unregistered id renders the shell's "not built yet" placeholder, which is
 * the honest result. Registering an empty component would make an unbuilt
 * widget look finished.
 */
export function registerClientWidgets(registry: WidgetRegistryService): void {
  registry.registerLoader('portfolio', () =>
    import('./portfolio-widget/portfolio-widget').then((m) => m.PortfolioWidget),
  );

  registry.registerLoader('client_health', () =>
    import('./client-health-widget/client-health-widget').then((m) => m.ClientHealthWidget),
  );

  registry.registerLoader('team_health_rollup', () =>
    import('./team-health-rollup-widget/team-health-rollup-widget').then(
      (m) => m.TeamHealthRollupWidget,
    ),
  );

  registry.registerLoader('department_overview', () =>
    import('./department-overview-widget/department-overview-widget').then(
      (m) => m.DepartmentOverviewWidget,
    ),
  );
}
