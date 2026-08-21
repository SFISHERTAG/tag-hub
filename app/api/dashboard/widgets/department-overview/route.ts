import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/api-session";
import { summarizeDepartment, type DepartmentSummary } from "@/lib/dashboard/team-rollup";
import { requireWidget } from "../../_lib/access";
import { handle, unwrap } from "../../_lib/http";
import { loadClientBook } from "../../_lib/client-book";
import { healthDisclosure, type SampleDataDisclosure } from "../../_lib/sample-data";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/dashboard/widgets/department-overview";

export type DepartmentOverviewResponse = {
  summary: DepartmentSummary;
  sampleData: SampleDataDisclosure;
};

/**
 * GET /api/dashboard/widgets/department-overview
 *
 * Port of the `department_overview` fetch: every active client, rolled up.
 * `department_overview` is tag_exec-only in WIDGET_REGISTRY, which is what
 * gates the whole-department read that lib/dashboard/csm-clients.ts warns
 * callers to gate themselves.
 */
export async function GET(): Promise<NextResponse> {
  return handle(CONTEXT, async () => {
    const gate = await requireApiSession(CONTEXT);
    if (!gate.ok) return gate.response;
    const { session } = gate;
    requireWidget(session, "department_overview");

    const clients = unwrap(await loadClientBook(session, "department", null));

    const body: DepartmentOverviewResponse = {
      summary: summarizeDepartment(clients),
      sampleData: healthDisclosure([
        "summary.avgHealthScore",
        "summary.needsAttentionCount",
        "summary.ascensionReadyCount",
        "summary.escalationAtRiskCount",
        "summary.booksByRisk[].avgHealthScore",
      ]),
    };
    return NextResponse.json(body);
  });
}
