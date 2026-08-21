import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/api-session";
import { requireWidget } from "../../_lib/access";
import { handle, unwrap } from "../../_lib/http";
import { loadClientBook } from "../../_lib/client-book";
import { healthDisclosure, toClientDtos, type ClientDataDto, type SampleDataDisclosure } from "../../_lib/sample-data";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/dashboard/widgets/portfolio";

export type PortfolioWidgetResponse = {
  clients: ClientDataDto[];
  sampleData: SampleDataDisclosure;
};

/**
 * GET /api/dashboard/widgets/portfolio
 *
 * Port of legacy/dashboard/page.tsx's `portfolio` fetch. The book is derived
 * from the session (CSM sees assignments, CSD sees their team, exec sees the
 * department) — this endpoint takes no scope argument at all, so there is no
 * caller-supplied identity to check. /api/clients is the endpoint that offers
 * an explicit scope.
 */
export async function GET(): Promise<NextResponse> {
  return handle(CONTEXT, async () => {
    const gate = await requireApiSession(CONTEXT);
    if (!gate.ok) return gate.response;
    const { session } = gate;
    requireWidget(session, "portfolio");

    const clients = unwrap(await loadClientBook(session, "mine", null));

    const body: PortfolioWidgetResponse = {
      clients: toClientDtos(clients),
      sampleData: healthDisclosure([
        "clients[].health",
        "clients[].metrics",
        "clients[].escalation.bucket",
      ]),
    };
    return NextResponse.json(body);
  });
}
