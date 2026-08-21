import type { WidgetRegistryService } from './shared/widgets/widget-registry.service';
import { registerClientWidgets } from './features/clients/widgets/client-widget-loaders';

/**
 * The dashboard's composition root, and the one file allowed to import a
 * feature from outside `features/` — the declared exemption in CLAUDE.md and in
 * the `ignores` of web/eslint.config.js.
 *
 * The rule it exists to keep true: `shared/widgets/widget-registry.service.ts`
 * resolves widgets by id and must never import a feature, or the dashboard
 * shell stops being ignorant of which integrations exist and every widget lands
 * in the initial bundle. So each feature exports a `register*Widgets(registry)`
 * function, and exactly one place calls them. That place is here.
 *
 * Every loader inside those functions is a dynamic import, so registration
 * costs a handful of `Map.set` calls at startup and downloads nothing. A hat
 * whose saved layout contains none of a feature's widgets never fetches them.
 *
 * Called once from `provideAppInitializer` in app.config.ts, which runs before
 * the router activates a route, so the registry is populated before any
 * `WidgetHost` asks it a question. A widget id with no registered loader
 * renders WidgetHost's "not built yet" tile rather than throwing — which is why
 * forgetting to add a feature here fails quietly, and why the list of callers
 * belongs in one readable place instead of being spread across feature
 * bootstraps.
 *
 * `team_performance` is in the shared registry and deliberately has no loader:
 * there is no `/api/dashboard/widgets/team-performance` endpoint. The
 * placeholder tile is the honest state.
 */
export function registerWidgetLoaders(registry: WidgetRegistryService): void {
  registerClientWidgets(registry);
}
