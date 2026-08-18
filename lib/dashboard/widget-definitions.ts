// Client-safe widget definitions (no server-only imports)
import type { Role } from "@/lib/auth/roles";

export type WidgetSize = {
  cols: number;
  rows: number;
};

export type WidgetPlacement = {
  id: string;
  widgetId: string;
  position: { x: number; y: number };
  size: WidgetSize;
};

export type DashboardPage = {
  id: string;
  title: string;
  icon?: string;
  widgets: WidgetPlacement[];
};

export type DashboardConfig = {
  role: Role;
  pages: DashboardPage[];
  currentPage: number;
  updatedAt: number;
};

/**
 * Widget metadata.
 * Widgets declare which roles can access them and their default size.
 */
export type WidgetDefinition = {
  id: string;
  title: string;
  icon?: string;
  availableFor: Role[];
  defaultSize: WidgetSize;
  description?: string;
};

/**
 * Registry of all available widgets.
 * Add new widgets here with their metadata.
 */
export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  pipeline_board: {
    id: "pipeline_board",
    title: "Top Deals",
    availableFor: ["client_closer", "client_manager", "tag_exec", "tag_csm"],
    defaultSize: { cols: 2, rows: 2 },
    description: "Highest-value deals in your pipeline, ranked",
  },
  day_view: {
    id: "day_view",
    title: "Today's Schedule",
    availableFor: ["client_closer", "tag_exec"],
    defaultSize: { cols: 2, rows: 1 },
    description: "Appointments and calls for today",
  },
  leads_funnel: {
    id: "leads_funnel",
    title: "Leads Funnel",
    availableFor: ["client_owner", "client_manager", "tag_exec", "tag_csm"],
    defaultSize: { cols: 1, rows: 1 },
    description: "Lead, booked, showed, closed counts",
  },
  spend_roas: {
    id: "spend_roas",
    title: "Spend & ROAS",
    availableFor: ["client_owner", "tag_exec"],
    defaultSize: { cols: 2, rows: 1 },
    description: "Ad spend and return on ad spend",
  },
  client_health: {
    id: "client_health",
    title: "Client Health",
    availableFor: ["tag_csm", "tag_csd", "tag_exec"],
    defaultSize: { cols: 1, rows: 1 },
    description: "Health signals and escalation flags",
  },
  portfolio: {
    id: "portfolio",
    title: "Portfolio",
    availableFor: ["tag_csm", "tag_csd", "tag_exec"],
    defaultSize: { cols: 2, rows: 2 },
    description: "All clients and their status",
  },
  team_performance: {
    id: "team_performance",
    title: "Team Performance",
    availableFor: ["tag_sales_manager", "tag_exec"],
    defaultSize: { cols: 2, rows: 1 },
    description: "Rep and team metrics",
  },
  team_health_rollup: {
    id: "team_health_rollup",
    title: "Team Health",
    availableFor: ["tag_csd"],
    defaultSize: { cols: 2, rows: 2 },
    description: "Every CSM on your team, worst book first",
  },
  department_overview: {
    id: "department_overview",
    title: "Department Overview",
    availableFor: ["tag_exec"],
    defaultSize: { cols: 2, rows: 2 },
    description: "Department-wide totals and which books need attention",
  },
  kpi_summary: {
    id: "kpi_summary",
    title: "KPI Summary",
    availableFor: ["client_owner", "client_manager", "tag_exec", "tag_csm"],
    defaultSize: { cols: 4, rows: 1 },
    description: "Spend, ROAS, cost per lead, and booking rate at a glance",
  },
  owner_calendar: {
    id: "owner_calendar",
    title: "My Calendar",
    availableFor: ["client_owner", "tag_exec"],
    defaultSize: { cols: 4, rows: 2 },
    description: "Your own scheduled calls — month view and upcoming list",
  },
};

/** Widget ids backed by lib/dashboard/mock-metrics.ts rather than a live data source yet. */
export const MOCK_METRICS_WIDGET_IDS = ["leads_funnel", "spend_roas", "kpi_summary"];

export function getAvailableWidgets(role: Role): WidgetDefinition[] {
  return Object.values(WIDGET_REGISTRY).filter((w) => w.availableFor.includes(role));
}
