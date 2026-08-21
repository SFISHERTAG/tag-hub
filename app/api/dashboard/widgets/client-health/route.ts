import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/api-session";
import { requireWidget } from "../../_lib/access";
import { handle, unwrap } from "../../_lib/http";
import { loadClientBook } from "../../_lib/client-book";
import { healthDisclosure, toClientDtos, type ClientDataDto, type SampleDataDisclosure } from "../../_lib/sample-data";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/dashboard/widgets/client-health";

export type ClientHealthWidgetResponse = {
  clients: ClientDataDto[];
  sampleData: SampleDataDisclosure;
};

/**
 * GET /api/dashboard/widgets/client-health
 *
 * Same client set as /portfolio, different framing — that split is how the
 * reference implementation had it (one `portfolioClients` fetch backing both
 * widgets). It is a separate endpoint rather than a shared one because
 * `client_health` and `portfolio` carry separate `availableFor` lists and the
 * entitlement check has to be per widget, not per data source.
 *
 * Every score in this payload is fabricated. `sampleData.isSample` and the
 * per-record `health.is_sample` both say so; render a visible notice.
 */
export async function GET(): Promise<NextResponse> {
  return handle(CONTEXT, async () => {
    const gate = await requireApiSession(CONTEXT);
    if (!gate.ok) return gate.response;
    const { session } = gate;
    requireWidget(session, "client_health");

    const clients = unwrap(await loadClientBook(session, "mine", null));

    const body: ClientHealthWidgetResponse = {
      clients: toClientDtos(clients),
      sampleData: healthDisclosure([
        "clients[].health.score",
        "clients[].health.status",
        "clients[].escalation.bucket",
      ]),
    };
    return NextResponse.json(body);
  });
}
