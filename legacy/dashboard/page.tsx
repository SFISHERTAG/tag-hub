import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { getLocationForDashboard } from "@/lib/dashboard/location-selection";
import { WIDGET_REGISTRY } from "@/lib/dashboard/widget-definitions";
import { loadDashboardConfig } from "@/lib/dashboard/customization";
import { getLastUpdated } from "@/lib/dashboard/freshness";
import { getAssignedClients, getTeamClients, getDepartmentClients } from "@/lib/dashboard/csm-clients";
import type { ClientData } from "@/lib/dashboard/csm-clients-types";
import { summarizeByCsm, summarizeDepartment } from "@/lib/dashboard/team-rollup";
import type { CsmBookSummary, DepartmentSummary } from "@/lib/dashboard/team-rollup";
import { getPipelineBoardSummary, type PipelineBoardResult } from "@/lib/dashboard/pipeline-board";
import { getTodayCalls, type DayViewResult } from "@/lib/dashboard/day-view";
import { getDashboardFunnelCounts, type FunnelCountsResult } from "@/lib/dashboard/funnel";
import { getOwnerCalendar, type OwnerCalendarResult } from "@/lib/dashboard/owner-calendar";
import { getDashboardAdRoas, type RoasTableResult } from "@/lib/dashboard/roas";
import { DarkScope } from "./dark-scope";
import { DashboardPageClient } from "./page-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/signin");

  const { page: requestedPageId } = await searchParams;

  // Load dashboard config for current role
  const config = await loadDashboardConfig(session.uid, session.currentRole);

  // PageTabs links to /dashboard?page=<id>, and nothing read that parameter —
  // every tab rendered the saved current page, so multi-page dashboards were
  // a no-op. An unknown or absent id falls back to the saved page rather than
  // erroring, so a stale bookmark degrades instead of breaking.
  //
  // Widget entitlement is enforced further down, per widget, at the point of
  // fetch — see `canUseWidget` below.
  const currentPage =
    config.pages.find((p) => p.id === requestedPageId) ?? config.pages[config.currentPage];

  if (!currentPage) redirect("/");

  const widgetIds = new Set(currentPage.widgets.map((w) => w.widgetId));

  // Widgets that need role-scoped or external data the generic
  // widget-registry path doesn't fetch — pulled here rather than in
  // WidgetGrid since it's a client component and this is server-only data.
  let teamHealthRollup: CsmBookSummary[] | undefined;
  let departmentOverview: DepartmentSummary | undefined;
  let portfolioClients: ClientData[] | undefined;
  let pipelineBoard: PipelineBoardResult | undefined;
  let dayView: DayViewResult | undefined;
  let funnel: FunnelCountsResult | undefined;
  let ownerCalendar: OwnerCalendarResult | undefined;
  let roas: RoasTableResult | undefined;

  // A failed fetch here still renders "no clients" rather than a distinct
  // error state — the fix in this pass is that the failure is no longer
  // indistinguishable from a real empty result in the server log (see
  // lib/api/errorInterceptor.ts); a dedicated error UI per widget is a
  // follow-up, not part of this change.
  if (hasAnyRole(session.currentRole, ["tag_csd"]) && session.email) {
    teamHealthRollup = summarizeByCsm((await getTeamClients(session.email)).data ?? []);
  } else if (hasAnyRole(session.currentRole, ["tag_exec"])) {
    departmentOverview = summarizeDepartment((await getDepartmentClients()).data ?? []);
  }

  if (widgetIds.has("portfolio") || widgetIds.has("client_health")) {
    if (hasAnyRole(session.currentRole, ["tag_csm"]) && session.email) {
      portfolioClients = (await getAssignedClients(session.email)).data ?? [];
    } else if (hasAnyRole(session.currentRole, ["tag_csd"]) && session.email) {
      portfolioClients = (await getTeamClients(session.email)).data ?? [];
    } else if (hasAnyRole(session.currentRole, ["tag_exec"])) {
      portfolioClients = (await getDepartmentClients()).data ?? [];
    }
  }

  // GHL-backed widgets need the caller's own location, not a shared dev
  // default — two different client tenants must never resolve to the same
  // location just because they both added the same widget. Resolution can
  // throw for a role/session shape it doesn't recognize; treated as "no
  // location" rather than crashing the whole dashboard.
  let dashboardLocationId: string | null = null;
  try {
    dashboardLocationId = getLocationForDashboard(session);
  } catch {
    dashboardLocationId = null;
  }

  // Each of these widgets declares its own availableFor role list in
  // widget-definitions.ts — checked here, not just at the picker/save layer,
  // since a saved config is what actually drives this fetch.
  const canUseWidget = (widgetId: string) =>
    hasAnyRole(session.currentRole, WIDGET_REGISTRY[widgetId]?.availableFor ?? []);

  if (widgetIds.has("pipeline_board") && canUseWidget("pipeline_board") && dashboardLocationId) {
    pipelineBoard = await getPipelineBoardSummary(dashboardLocationId);
  }

  if (widgetIds.has("day_view") && canUseWidget("day_view") && dashboardLocationId) {
    dayView = await getTodayCalls(dashboardLocationId);
  }

  if (widgetIds.has("leads_funnel") && canUseWidget("leads_funnel") && dashboardLocationId) {
    funnel = await getDashboardFunnelCounts(dashboardLocationId, 30);
  }

  if (widgetIds.has("owner_calendar") && canUseWidget("owner_calendar") && dashboardLocationId) {
    ownerCalendar = await getOwnerCalendar(dashboardLocationId);
  }

  if (widgetIds.has("spend_roas") && canUseWidget("spend_roas") && dashboardLocationId) {
    roas = await getDashboardAdRoas(dashboardLocationId, 30);
  }

  // PRD-required "as of" indicator. It existed as a component and a data
  // source, wired only into the location-scoped layout — never into the
  // dashboard people actually use. Freshness failing is not a reason to fail
  // the page, so it degrades to "no timestamp" rather than throwing.
  const lastUpdated = dashboardLocationId
    ? await getLastUpdated(dashboardLocationId).catch(() => ({ timestamp: null, source: null }))
    : { timestamp: null, source: null };

  return (
    <DarkScope>
      <div className="mx-auto max-w-6xl">
        {/* Dashboard with multi-page support */}
        <DashboardPageClient
          config={config}
          currentPageId={currentPage.id}
          userEmail={session.email || "Your Account"}
          locationId={dashboardLocationId}
          lastUpdated={lastUpdated.timestamp}
          teamHealthRollup={teamHealthRollup}
          departmentOverview={departmentOverview}
          portfolioClients={portfolioClients}
          pipelineBoard={pipelineBoard}
          dayView={dayView}
          funnel={funnel}
          ownerCalendar={ownerCalendar}
          roas={roas}
        />
      </div>
    </DarkScope>
  );
}
