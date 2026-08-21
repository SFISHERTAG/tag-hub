import { NextResponse, type NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/api-session";
import { getDashboardAdRoas, type RoasTableResult } from "@/lib/dashboard/roas";
import { MOCK_METRICS, type AdPerformance, type ChannelSpend } from "@/lib/dashboard/mock-metrics";
import { requireWidget, resolveDashboardLocation } from "../../_lib/access";
import { badRequest, handle } from "../../_lib/http";
import { kpiDisclosure, type SampleDataDisclosure } from "../../_lib/sample-data";
import { NO_LOCATION_WARNING, type WidgetWarning } from "../../_lib/widget-payload";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/dashboard/widgets/spend-roas";

export type SpendRoasResponse =
  | { source: "live"; days: number; roas: RoasTableResult; warnings: WidgetWarning[] }
  | {
      source: "sample";
      days: number;
      spendByChannel: ChannelSpend[];
      spendByAd: AdPerformance[];
      sampleData: SampleDataDisclosure;
      warnings: WidgetWarning[];
    };

/**
 * GET /api/dashboard/widgets/spend-roas?days=30
 *
 * Port of the `spend_roas` fetch. Live rows come from real Meta ad spend and
 * real GHL opportunity revenue (lib/dashboard/roas.ts), so `source: "live"`
 * carries no sample-data disclosure. Only the no-location fallback does.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return handle(CONTEXT, async () => {
    const gate = await requireApiSession(CONTEXT);
    if (!gate.ok) return gate.response;
    const { session } = gate;
    requireWidget(session, "spend_roas");

    const days = parseDays(request.nextUrl.searchParams.get("days"));
    const locationId = resolveDashboardLocation(session);

    if (!locationId) {
      const body: SpendRoasResponse = {
        source: "sample",
        days,
        spendByChannel: MOCK_METRICS.spendByChannel,
        spendByAd: MOCK_METRICS.spendByAd,
        sampleData: kpiDisclosure(["spendByChannel", "spendByAd"]),
        warnings: [NO_LOCATION_WARNING],
      };
      return NextResponse.json(body);
    }

    const roas = await getDashboardAdRoas(locationId, days);
    const body: SpendRoasResponse = { source: "live", days, roas, warnings: [] };
    return NextResponse.json(body);
  });
}

function parseDays(raw: string | null): number {
  if (raw === null || raw === "") return 30;
  const days = Number(raw);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw badRequest("`days` must be an integer between 1 and 365.");
  }
  return days;
}
