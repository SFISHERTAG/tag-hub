import type { Role } from '../../core/models/role.model';

/** Port of lib/dashboard/widget-definitions.ts — keep in sync with that file. */

export interface WidgetSize {
  cols: number;
  rows: number;
}

export interface WidgetPlacement {
  id: string;
  widgetId: string;
  position: { x: number; y: number };
  size: WidgetSize;
}

export interface DashboardPage {
  id: string;
  title: string;
  icon?: string;
  widgets: WidgetPlacement[];
}

export interface DashboardConfig {
  role: Role;
  pages: DashboardPage[];
  currentPage: number;
  updatedAt: number;
}

/** Widgets declare which roles can access them and their default size. */
export interface WidgetDefinition {
  id: string;
  title: string;
  icon?: string;
  availableFor: readonly Role[];
  defaultSize: WidgetSize;
  description?: string;
}
