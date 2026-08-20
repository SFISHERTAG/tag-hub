// Re-export client-safe definitions
export type { WidgetSize, WidgetPlacement, DashboardPage, DashboardConfig, WidgetDefinition } from "./widget-definitions";
export {
  WIDGET_REGISTRY,
  getAvailableWidgets,
  canUseWidget,
  filterWidgetsForRole,
  MOCK_METRICS_WIDGET_IDS,
} from "./widget-definitions";
