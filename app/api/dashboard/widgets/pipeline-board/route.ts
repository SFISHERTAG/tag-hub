import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/api-session";
import { getPipelineBoardSummary, type PipelineBoardResult } from "@/lib/dashboard/pipeline-board";
import { MOCK_METRICS } from "@/lib/dashboard/mock-metrics";
import { requireWidget, resolveDashboardLocation } from "../../_lib/access";
import { handle } from "../../_lib/http";
import { kpiDisclosure, type SampleDataDisclosure } from "../../_lib/sample-data";
import { NO_LOCATION_WARNING, type WidgetWarning } from "../../_lib/widget-payload";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/dashboard/widgets/pipeline-board";

export type TopDeal = { name: string; value: number; stage: string };

export type PipelineBoardResponse =
  | { source: "live"; pipeline: PipelineBoardResult; warnings: WidgetWarning[] }
  | {
      source: "sample";
      topDeals: TopDeal[];
      sampleData: SampleDataDisclosure;
      warnings: WidgetWarning[];
    };

/**
 * GET /api/dashboard/widgets/pipeline-board
 *
 * Port of the `pipeline_board` fetch, with the same MOCK_METRICS.topDeals
 * fallback legacy/dashboard/widget-grid.tsx used when no live fetch happened.
 */
export async function GET(): Promise<NextResponse> {
  return handle(CONTEXT, async () => {
    const gate = await requireApiSession(CONTEXT);
    if (!gate.ok) return gate.response;
    const { session } = gate;
    requireWidget(session, "pipeline_board");

    const locationId = resolveDashboardLocation(session);
    if (!locationId) {
      const body: PipelineBoardResponse = {
        source: "sample",
        topDeals: MOCK_METRICS.topDeals,
        sampleData: kpiDisclosure(["topDeals"]),
        warnings: [NO_LOCATION_WARNING],
      };
      return NextResponse.json(body);
    }

    const pipeline = await getPipelineBoardSummary(locationId);
    const body: PipelineBoardResponse = { source: "live", pipeline, warnings: [] };
    return NextResponse.json(body);
  });
}
