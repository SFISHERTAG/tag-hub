import { NextResponse, type NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/api-session";
import { getDashboardFunnelCounts, type FunnelCountsResult } from "@/lib/dashboard/funnel";
import { MOCK_METRICS, type FunnelStage } from "@/lib/dashboard/mock-metrics";
import { requireWidget, resolveDashboardLocation } from "../../_lib/access";
import { badRequest, handle } from "../../_lib/http";
import { kpiDisclosure, type SampleDataDisclosure } from "../../_lib/sample-data";
import {
  NO_LOCATION_WARNING,
  TRUNCATED_FUNNEL_WARNING,
  type WidgetWarning,
} from "../../_lib/widget-payload";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/dashboard/widgets/leads-funnel";

export type LeadsFunnelResponse =
  | { source: "live"; days: number; funnel: FunnelCountsResult; warnings: WidgetWarning[] }
  | {
      source: "sample";
      days: number;
      stages: FunnelStage[];
      sampleData: SampleDataDisclosure;
      warnings: WidgetWarning[];
    };

/**
 * GET /api/dashboard/widgets/leads-funnel?days=30
 *
 * Port of legacy/dashboard/page.tsx's `leads_funnel` fetch plus the
 * mock-metrics fallback legacy/dashboard/widget-grid.tsx applied when no live
 * fetch happened.
 *
 * The `truncated` flag is promoted into `warnings` as well as left on the
 * result. It marks the case where the contact fetch hit its page cap: every
 * stage count is then an undercount, and the whole point of the flag is that
 * this must not render as a confident number. A consumer that ignores
 * `funnel.truncated` still has to walk past `warnings`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return handle(CONTEXT, async () => {
    const gate = await requireApiSession(CONTEXT);
    if (!gate.ok) return gate.response;
    const { session } = gate;
    requireWidget(session, "leads_funnel");

    const days = parseDays(request.nextUrl.searchParams.get("days"));
    const locationId = resolveDashboardLocation(session);

    if (!locationId) {
      const body: LeadsFunnelResponse = {
        source: "sample",
        days,
        stages: MOCK_METRICS.funnel,
        sampleData: kpiDisclosure(["stages"]),
        warnings: [NO_LOCATION_WARNING],
      };
      return NextResponse.json(body);
    }

    const funnel = await getDashboardFunnelCounts(locationId, days);
    const warnings: WidgetWarning[] = [];
    if (funnel.ok && funnel.truncated) warnings.push(TRUNCATED_FUNNEL_WARNING);

    const body: LeadsFunnelResponse = { source: "live", days, funnel, warnings };
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
