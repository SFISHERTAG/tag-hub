import { requireSession } from "@/lib/auth/session";
import { devLocationId } from "@/lib/ghl/tokens";
import { getLocationConfig } from "@/lib/dashboard/location-config";
import { MOCK_METRICS } from "@/lib/dashboard/mock-metrics";
import { getLocationForDashboard } from "@/lib/dashboard/location-selection";
import {
  fetchCreatives,
  fetchCalls,
  fetchResources,
  fetchUpcomingCalls,
  type CreativeForDisplay,
  type CallForDisplay,
  type ResourceForDisplay,
} from "@/lib/dashboard/data-fetchers";
import { DarkScope } from "./dark-scope";
import { DashboardLayout } from "./dashboard-layout";
import { DashboardPageClient } from "./page-client";
import { SampleDataBanner } from "./widgets/sample-data-banner";
import { SpendCharts } from "./widgets/spend-charts";
import { FunnelTable } from "./widgets/funnel-table";
import { TopDeals } from "./widgets/top-deals";
import { DocumentsWidget } from "./widgets/documents-widget";
import { SlackWidget } from "./widgets/slack-widget";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSession();

  // Gated on the effective hat, not the raw role
  if (!session || !["client_owner", "client_manager", "tag_exec", "tag_csm"].includes(session.hat)) {
    return (
      <div className="max-w-2xl rounded-lg border border-warn/30 bg-warn-tint p-6 text-warn">
        <h2 className="text-base font-semibold">Access denied</h2>
        <p className="mt-2 text-sm">Only client owners, managers, and team members can view the dashboard.</p>
      </div>
    );
  }

  // Determine location based on user role
  let locationId = "";
  try {
    locationId = getLocationForDashboard(session);
  } catch (error) {
    return (
      <div className="max-w-2xl rounded-lg border border-warn/30 bg-warn-tint p-6 text-warn">
        <h2 className="text-base font-semibold">Setup needed</h2>
        <p className="mt-2 text-sm">
          No location configured. {error instanceof Error ? error.message : "Contact support."}
        </p>
      </div>
    );
  }

  const { slackChannelId, driveFolderId } = await getLocationConfig(locationId);

  // Fetch live data
  let creatives: CreativeForDisplay[] = [];
  let calls: CallForDisplay[] = [];
  let resources: ResourceForDisplay[] = [];
  let upcomingCalls: CallForDisplay[] = [];

  try {
    // Fetch all data in parallel
    const [creativesData, callsData, resourcesData, upcomingCallsData] = await Promise.all([
      fetchCreatives(locationId),
      fetchCalls(locationId, 0), // Today
      fetchResources(locationId),
      fetchUpcomingCalls(locationId, 7), // Next 7 days
    ]);

    creatives = creativesData;
    calls = callsData;
    resources = resourcesData;
    upcomingCalls = upcomingCallsData;
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    // Fall back gracefully - show empty screens instead of crashing
  }

  // Render server-side dashboard content
  const dashboardContent = (
    <>
      <SpendCharts
        spendByChannel={MOCK_METRICS.spendByChannel}
        spendByAd={MOCK_METRICS.spendByAd}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <FunnelTable funnel={MOCK_METRICS.funnel} />
        <TopDeals deals={MOCK_METRICS.topDeals} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DocumentsWidget folderId={driveFolderId} />
        <SlackWidget channelId={slackChannelId} />
      </div>
    </>
  );

  return (
    <DarkScope>
      <div className="mx-auto max-w-6xl">
        <SampleDataBanner />
        <DashboardPageClient
          accountName={session.email || "Your Account"}
          dashboardContent={dashboardContent}
          initialCreatives={creatives}
          initialCalls={calls}
          initialResources={resources}
          initialUpcomingCalls={upcomingCalls}
        />
      </div>
    </DarkScope>
  );
}
