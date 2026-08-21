import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/api-session";
import { summarizeByCsm, type CsmBookSummary } from "@/lib/dashboard/team-rollup";
import { requireWidget } from "../../_lib/access";
import { handle, unwrap } from "../../_lib/http";
import { loadClientBook } from "../../_lib/client-book";
import { healthDisclosure, type SampleDataDisclosure } from "../../_lib/sample-data";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/dashboard/widgets/team-health-rollup";

export type TeamHealthRollupResponse = {
  books: CsmBookSummary[];
  sampleData: SampleDataDisclosure;
};

/**
 * GET /api/dashboard/widgets/team-health-rollup
 *
 * Port of the `team_health_rollup` fetch: every CSM reporting to the calling
 * CSD, worst book first. The CSD is `session.email`, never a parameter.
 *
 * Every score aggregated here comes from the same fabricated per-client
 * metrics, which means "worst book first" is not currently a real ranking.
 * That is exactly why the disclosure is mandatory on this surface: an ordered
 * list reads as a judgement even harder than a single number does.
 */
export async function GET(): Promise<NextResponse> {
  return handle(CONTEXT, async () => {
    const gate = await requireApiSession(CONTEXT);
    if (!gate.ok) return gate.response;
    const { session } = gate;
    requireWidget(session, "team_health_rollup");

    const clients = unwrap(await loadClientBook(session, "team", null));

    const body: TeamHealthRollupResponse = {
      books: summarizeByCsm(clients),
      sampleData: healthDisclosure([
        "books[].avgHealthScore",
        "books[].excellent",
        "books[].healthy",
        "books[].atRisk",
        "books[].critical",
        "books[].alert",
        "books[].ascensionReadyCount",
        "books[].escalationAtRiskCount",
      ]),
    };
    return NextResponse.json(body);
  });
}
