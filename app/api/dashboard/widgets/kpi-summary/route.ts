import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/api-session";
import { MOCK_METRICS, type MockMetrics } from "@/lib/dashboard/mock-metrics";
import { requireWidget } from "../../_lib/access";
import { handle } from "../../_lib/http";
import { kpiDisclosure, type SampleDataDisclosure } from "../../_lib/sample-data";
import { SAMPLE_DATA_WARNING, type WidgetWarning } from "../../_lib/widget-payload";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/dashboard/widgets/kpi-summary";

export type KpiSummaryResponse = {
  source: "sample";
  kpis: MockMetrics["kpis"];
  sampleData: SampleDataDisclosure;
  warnings: WidgetWarning[];
};

/**
 * GET /api/dashboard/widgets/kpi-summary
 *
 * Port of the `kpi_summary` widget. There is no live path at all — the
 * reference implementation renders MOCK_METRICS.kpis unconditionally, so
 * `source` is a literal `"sample"` rather than a union. The moment a real
 * fetch exists this becomes a union and the disclosure becomes conditional;
 * until then a caller cannot accidentally treat these as readings.
 */
export async function GET(): Promise<NextResponse> {
  return handle(CONTEXT, async () => {
    const gate = await requireApiSession(CONTEXT);
    if (!gate.ok) return gate.response;
    const { session } = gate;
    requireWidget(session, "kpi_summary");

    const body: KpiSummaryResponse = {
      source: "sample",
      kpis: MOCK_METRICS.kpis,
      sampleData: kpiDisclosure([
        "kpis.spendActual",
        "kpis.spendBudget",
        "kpis.roas",
        "kpis.cpl",
        "kpis.bookingRatePct",
        "kpis.costPerBooked",
      ]),
      warnings: [SAMPLE_DATA_WARNING],
    };
    return NextResponse.json(body);
  });
}
