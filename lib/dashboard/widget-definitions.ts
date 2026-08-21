// Client-safe widget definitions (no server-only imports)
import type { Role } from "@/lib/auth/roles";
import { canSee, resolveFields, type FieldAllowlist } from "./field-visibility";

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
  /**
   * Catalog field ids this widget renders (Story 7.4). Required, not optional:
   * an optional list makes "forgot to declare" mean "offered to everyone",
   * which is the forgotten-conditional failure the allowlist exists to remove.
   *
   * An empty array is a real answer — it says the widget renders nothing from
   * the client field catalog — but it has to be typed deliberately.
   *
   * `getAvailableWidgets` will not offer a widget to a hat that cannot see
   * every field in this list, so this is what keeps a future margin widget off
   * a client's picker without anyone having to remember a conditional.
   */
  fields: string[];
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
    fields: ["sales.pipelineOpen", "sales.avgDealSize"],
  },
  day_view: {
    id: "day_view",
    title: "Today's Schedule",
    availableFor: ["client_closer", "tag_exec"],
    defaultSize: { cols: 2, rows: 1 },
    description: "Appointments and calls for today",
    fields: ["funnel.bookedCalls"],
  },
  leads_funnel: {
    id: "leads_funnel",
    title: "Leads Funnel",
    availableFor: ["client_owner", "client_manager", "tag_exec", "tag_csm"],
    defaultSize: { cols: 1, rows: 1 },
    description: "Lead, booked, showed, closed counts",
    fields: ["funnel.leads", "funnel.bookedCalls", "sales.showRate", "sales.closes"],
  },
  spend_roas: {
    id: "spend_roas",
    title: "Spend & ROAS",
    availableFor: ["client_owner", "tag_exec"],
    defaultSize: { cols: 2, rows: 1 },
    description: "Ad spend and return on ad spend",
    fields: ["spend.actual", "econ.roas"],
  },
  client_health: {
    id: "client_health",
    title: "Client Health",
    availableFor: ["tag_csm", "tag_csd", "tag_exec"],
    defaultSize: { cols: 1, rows: 1 },
    description: "Health signals and escalation flags",
    fields: [
      "health.status",
      "health.reason",
      "health.trend",
      "risk.escalation",
      "risk.escalationReason",
    ],
  },
  portfolio: {
    id: "portfolio",
    title: "Portfolio",
    availableFor: ["tag_csm", "tag_csd", "tag_exec"],
    defaultSize: { cols: 2, rows: 2 },
    description: "All clients and their status",
    fields: ["client.name", "onboard.stage", "health.status"],
  },
  team_performance: {
    id: "team_performance",
    title: "Team Performance",
    availableFor: ["tag_sales_manager", "tag_exec"],
    defaultSize: { cols: 2, rows: 1 },
    description: "Rep and team metrics",
    fields: ["sales.callsTaken", "sales.showRate", "sales.closeRate", "sales.revenueClosed"],
  },
  team_health_rollup: {
    id: "team_health_rollup",
    title: "Team Health",
    availableFor: ["tag_csd"],
    defaultSize: { cols: 2, rows: 2 },
    description: "Every CSM on your team, worst book first",
    fields: ["health.status", "health.trend", "risk.escalation"],
  },
  department_overview: {
    id: "department_overview",
    title: "Department Overview",
    availableFor: ["tag_exec"],
    defaultSize: { cols: 2, rows: 2 },
    description: "Department-wide totals and which books need attention",
    fields: ["health.status", "risk.escalation", "sales.revenueClosed", "spend.actual"],
  },
  kpi_summary: {
    id: "kpi_summary",
    title: "KPI Summary",
    // No client_manager: this renders spend, ROAS and cost per lead, and
    // docs/client-fields.md marks all three `never` for that hat — only the
    // owner sees what the work costs. It was offered to managers until the
    // field declarations below made the contradiction visible.
    availableFor: ["client_owner", "tag_exec", "tag_csm"],
    defaultSize: { cols: 4, rows: 1 },
    description: "Spend, ROAS, cost per lead, and booking rate at a glance",
    fields: ["spend.actual", "econ.roas", "funnel.cpl", "funnel.bookingRate"],
  },
  owner_calendar: {
    id: "owner_calendar",
    title: "My Calendar",
    availableFor: ["client_owner", "tag_exec"],
    defaultSize: { cols: 4, rows: 2 },
    description: "Your own scheduled calls — month view and upcoming list",
    fields: ["funnel.bookedCalls"],
  },
};

/**
 * Widget ids backed by lib/dashboard/mock-metrics.ts rather than a live data
 * source yet. portfolio/client_health render getMockMetrics()-derived health
 * scores and escalation status — the same fabrication as the KPI widgets,
 * just reached through lib/dashboard/csm-clients.ts instead of directly.
 */
export const MOCK_METRICS_WIDGET_IDS = ["leads_funnel", "spend_roas", "kpi_summary", "portfolio", "client_health"];

/**
 * The widgets a hat may place: the intersection of two questions, not just the
 * first. Does the role own this widget, and may it see every field the widget
 * renders?
 *
 * There is deliberately no exported way to get the role-only list. A caller who
 * wanted "just the widgets for this role" is the caller about to offer a client
 * a widget full of TAG's margin.
 */
export function isOfferable(
  widget: WidgetDefinition,
  role: Role,
  allowlist: FieldAllowlist,
): boolean {
  return widget.availableFor.includes(role) && widget.fields.every((id) => canSee(allowlist, id));
}

export function getAvailableWidgets(role: Role): WidgetDefinition[] {
  const allowlist = resolveFields(role);
  return Object.values(WIDGET_REGISTRY).filter((w) => isOfferable(w, role, allowlist));
}
