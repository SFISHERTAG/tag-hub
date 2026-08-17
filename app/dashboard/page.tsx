import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { loadDashboardConfig } from "@/lib/dashboard/customization";
import { getTeamClients, getDepartmentClients } from "@/lib/dashboard/csm-clients";
import { summarizeByCsm, summarizeDepartment } from "@/lib/dashboard/team-rollup";
import type { CsmBookSummary, DepartmentSummary } from "@/lib/dashboard/team-rollup";
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

  // team_health_rollup and department_overview need role-scoped data the
  // generic widget-registry path doesn't fetch — pulled here rather than in
  // WidgetGrid since it's a client component and this is server-only data.
  let teamHealthRollup: CsmBookSummary[] | undefined;
  let departmentOverview: DepartmentSummary | undefined;

  if (session.currentRole === "tag_csd" && session.email) {
    teamHealthRollup = summarizeByCsm(await getTeamClients(session.email));
  } else if (session.currentRole === "tag_exec") {
    departmentOverview = summarizeDepartment(await getDepartmentClients());
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
        />
      </div>
    </DarkScope>
  );
}
