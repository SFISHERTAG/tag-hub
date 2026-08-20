import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { loadDashboardConfig } from "@/lib/dashboard/customization";
import { filterWidgetsForRole } from "@/lib/dashboard/widget";
import { resolveDashboardLocation } from "@/lib/dashboard/location-selection";
import { ownsLocation } from "@/lib/auth/session";
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

  // Load dashboard config for current role.
  //
  // The saved layout is caller-supplied data — it was written by a server
  // action, but a layout can also outlive a role change. Filtering here is
  // the second half of the allowlist enforced on save: nothing below fetches
  // data for a widget id this role is not entitled to.
  const config = filterWidgetsForRole(
    session.currentRole,
    await loadDashboardConfig(session.uid, session.currentRole),
  );
  // PageTabs links to /dashboard?page=<id>, and nothing read that parameter —
  // every tab rendered the same page, so multi-page dashboards were a no-op.
  // An unknown or absent id falls back to the saved current page rather than
  // erroring, so a stale bookmark degrades instead of breaking.
  const currentPage =
    config.pages.find((p) => p.id === requestedPageId) ?? config.pages[config.currentPage];

  if (!currentPage) redirect("/");

  const widgetIds = new Set(currentPage.widgets.map((w) => w.widgetId));

  // Which tenant's GHL data these widgets read. Resolved from the session
  // and then access-checked, rather than from a global env var: two client
  // tenants with the same widget must not resolve to the same location.
  const resolved = resolveDashboardLocation(session);
  const locationId =
    resolved.ok && (await ownsLocation(session, resolved.locationId))
      ? resolved.locationId
      : null;
  const noLocation: { ok: false; message: string } = {
    ok: false,
    message: resolved.ok
      ? "This login does not have access to that client account."
      : resolved.message,
  };

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

  if (widgetIds.has("pipeline_board")) {
    pipelineBoard = locationId ? await getPipelineBoardSummary(locationId) : noLocation;
  }

  if (widgetIds.has("day_view")) {
    dayView = locationId ? await getTodayCalls(locationId) : noLocation;
  }

  if (widgetIds.has("leads_funnel")) {
    funnel = locationId ? await getDashboardFunnelCounts(locationId, 30) : noLocation;
  }

  if (widgetIds.has("owner_calendar")) {
    ownerCalendar = locationId ? await getOwnerCalendar(locationId) : noLocation;
  }

  if (widgetIds.has("spend_roas")) {
    roas = locationId ? await getDashboardAdRoas(locationId, 30) : noLocation;
  }

  // PRD-required "as of" indicator. It existed as a component and a data
  // source, wired only into the location-scoped layout — never into the
  // dashboard people actually use. Freshness failing is not a reason to fail
  // the page, so it degrades to "no timestamp" rather than throwing.
  const lastUpdated = locationId
    ? await getLastUpdated(locationId).catch(() => ({ timestamp: null, source: null }))
    : { timestamp: null, source: null };

  return (
    <DarkScope>
      <div className="mx-auto max-w-6xl">
        {/* Dashboard with multi-page support */}
        <DashboardPageClient
          config={config}
          currentPageId={currentPage.id}
          userEmail={session.email || "Your Account"}
          locationId={locationId}
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
