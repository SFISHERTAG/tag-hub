// Client-safe widget definitions (no server-only imports)
// ROLES comes from role-labels, not roles.ts: this file is client-safe and
// roles.ts is server-only. role-labels.ts deliberately carries no server-only
// marker for exactly this case.
import { ROLES } from "@/lib/auth/role-labels";
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
    availableFor: [ROLES.CLIENT_CLOSER, ROLES.CLIENT_MANAGER, ROLES.TAG_EXEC, ROLES.TAG_CSM],
    defaultSize: { cols: 2, rows: 2 },
    description: "Highest-value deals in your pipeline, ranked",
  },
  day_view: {
    id: "day_view",
    title: "Today's Schedule",
    availableFor: [ROLES.CLIENT_CLOSER, ROLES.TAG_EXEC],
    defaultSize: { cols: 2, rows: 1 },
    description: "Appointments and calls for today",
  },
  leads_funnel: {
    id: "leads_funnel",
    title: "Leads Funnel",
    availableFor: [ROLES.CLIENT_OWNER, ROLES.CLIENT_MANAGER, ROLES.TAG_EXEC, ROLES.TAG_CSM],
    defaultSize: { cols: 1, rows: 1 },
    description: "Lead, booked, showed, closed counts",
  },
  spend_roas: {
    id: "spend_roas",
    title: "Spend & ROAS",
    availableFor: [ROLES.CLIENT_OWNER, ROLES.TAG_EXEC],
    defaultSize: { cols: 2, rows: 1 },
    description: "Ad spend and return on ad spend",
  },
  client_health: {
    id: "client_health",
    title: "Client Health",
    availableFor: [ROLES.TAG_CSM, ROLES.TAG_CSD, ROLES.TAG_EXEC],
    defaultSize: { cols: 1, rows: 1 },
    description: "Health signals and escalation flags",
  },
  portfolio: {
    id: "portfolio",
    title: "Portfolio",
    availableFor: [ROLES.TAG_CSM, ROLES.TAG_CSD, ROLES.TAG_EXEC],
    defaultSize: { cols: 2, rows: 2 },
    description: "All clients and their status",
  },
  team_performance: {
    id: "team_performance",
    title: "Team Performance",
    availableFor: [ROLES.TAG_SALES_MANAGER, ROLES.TAG_EXEC],
    defaultSize: { cols: 2, rows: 1 },
    description: "Rep and team metrics",
  },
  team_health_rollup: {
    id: "team_health_rollup",
    title: "Team Health",
    availableFor: [ROLES.TAG_CSD],
    defaultSize: { cols: 2, rows: 2 },
    description: "Every CSM on your team, worst book first",
  },
  department_overview: {
    id: "department_overview",
    title: "Department Overview",
    availableFor: [ROLES.TAG_EXEC],
    defaultSize: { cols: 2, rows: 2 },
    description: "Department-wide totals and which books need attention",
  },
  kpi_summary: {
    id: "kpi_summary",
    title: "KPI Summary",
    availableFor: [ROLES.CLIENT_OWNER, ROLES.CLIENT_MANAGER, ROLES.TAG_EXEC, ROLES.TAG_CSM],
    defaultSize: { cols: 4, rows: 1 },
    description: "Spend, ROAS, cost per lead, and booking rate at a glance",
  },
  owner_calendar: {
    id: "owner_calendar",
    title: "My Calendar",
    availableFor: [ROLES.CLIENT_OWNER, ROLES.TAG_EXEC],
    defaultSize: { cols: 4, rows: 2 },
    description: "Your own scheduled calls — month view and upcoming list",
  },
};

/**
 * Widget ids backed by lib/dashboard/mock-metrics.ts rather than a live data
 * source yet. portfolio/client_health render getMockMetrics()-derived health
 * scores and escalation status — the same fabrication as the KPI widgets,
 * just reached through lib/dashboard/csm-clients.ts instead of directly.
 */
export const MOCK_METRICS_WIDGET_IDS = ["leads_funnel", "spend_roas", "kpi_summary", "portfolio", "client_health"];

export function getAvailableWidgets(role: Role): WidgetDefinition[] {
  return Object.values(WIDGET_REGISTRY).filter((w) => w.availableFor.includes(role));
}
