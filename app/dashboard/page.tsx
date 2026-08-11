import { requireSession } from "@/lib/auth/session";
import { devLocationId } from "@/lib/ghl/tokens";
import { getLocationConfig } from "@/lib/dashboard/location-config";
import { MOCK_METRICS } from "@/lib/dashboard/mock-metrics";
import { DarkScope } from "./dark-scope";
import { SampleDataBanner } from "./widgets/sample-data-banner";
import { KpiTiles } from "./widgets/kpi-tiles";
import { SpendCharts } from "./widgets/spend-charts";
import { FunnelTable } from "./widgets/funnel-table";
import { TopDeals } from "./widgets/top-deals";
import { DocumentsWidget } from "./widgets/documents-widget";
import { SlackWidget } from "./widgets/slack-widget";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSession();

  if (!session || !["client_owner", "client_manager"].includes(session.role)) {
    return (
      <div className="max-w-2xl rounded-lg border border-warn/30 bg-warn-tint p-6 text-warn">
        <h2 className="text-base font-semibold">Access denied</h2>
        <p className="mt-2 text-sm">Only client owners and managers can view the dashboard.</p>
      </div>
    );
  }

  // Per-client location routing (Story 1.2/1.6) isn't built yet, so a real
  // client_owner claim wins when present and single-location dev falls back
  // to GHL_LOCATION_ID — same fallback every other page in the app already
  // uses.
  const locationId = session.locations[0] ?? devLocationId();
  if (!locationId) {
    return (
      <div className="max-w-2xl rounded-lg border border-warn/30 bg-warn-tint p-6 text-warn">
        <h2 className="text-base font-semibold">Setup needed</h2>
        <p className="mt-2 text-sm">
          No location configured. Set <code>GHL_LOCATION_ID</code> in{" "}
          <code>hub/.env.local</code>, or assign this account a location.
        </p>
      </div>
    );
  }

  const { slackChannelId, driveFolderId } = await getLocationConfig(locationId);

  return (
    <DarkScope>
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Dashboard</h1>

        <SampleDataBanner />

        <KpiTiles kpis={MOCK_METRICS.kpis} />

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
      </div>
    </DarkScope>
  );
}
