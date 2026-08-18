import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { loadDashboardConfig } from "@/lib/dashboard/customization";
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

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  // Load dashboard config for current role
  const config = await loadDashboardConfig(session.uid, session.currentRole);
  const currentPage = config.pages[config.currentPage];

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

  if (hasAnyRole(session.currentRole, ["tag_csd"]) && session.email) {
    teamHealthRollup = summarizeByCsm(await getTeamClients(session.email));
  } else if (hasAnyRole(session.currentRole, ["tag_exec"])) {
    departmentOverview = summarizeDepartment(await getDepartmentClients());
  }

  if (widgetIds.has("portfolio") || widgetIds.has("client_health")) {
    if (hasAnyRole(session.currentRole, ["tag_csm"]) && session.email) {
      portfolioClients = await getAssignedClients(session.email);
    } else if (hasAnyRole(session.currentRole, ["tag_csd"]) && session.email) {
      portfolioClients = await getTeamClients(session.email);
    } else if (hasAnyRole(session.currentRole, ["tag_exec"])) {
      portfolioClients = await getDepartmentClients();
    }
  }

  if (widgetIds.has("pipeline_board")) {
    pipelineBoard = await getPipelineBoardSummary();
  }

  if (widgetIds.has("day_view")) {
    dayView = await getTodayCalls();
  }

  if (widgetIds.has("leads_funnel")) {
    funnel = await getDashboardFunnelCounts(30);
  }

  if (widgetIds.has("owner_calendar")) {
    ownerCalendar = await getOwnerCalendar();
  }

  if (widgetIds.has("spend_roas")) {
    roas = await getDashboardAdRoas(30);
  }

  return (
    <DarkScope>
      <div className="mx-auto max-w-6xl">
        {/* Dashboard with multi-page support */}
        <DashboardPageClient
          config={config}
          currentPageId={currentPage.id}
          userEmail={session.email || "Your Account"}
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
