import { NextResponse } from "next/server";
import { getClientDetail } from "@/lib/dashboard/csm-clients";
import { handle, notFound, unwrap } from "../../dashboard/_lib/http";
import { gateClient } from "../_lib/gate";
import { healthDisclosure, toClientDto, type ClientDataDto, type SampleDataDisclosure } from "../../dashboard/_lib/sample-data";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/clients/[clientId]";

export type ClientDetailResponse = {
  client: ClientDataDto;
  sampleData: SampleDataDisclosure;
};

/**
 * GET /api/clients/[clientId]
 *
 * One client, with the same computed health/escalation block the book carries.
 * Backs the client detail modal's header and overview tab, which the reference
 * implementation fed from the already-loaded list object; fetching it lets the
 * modal be opened from a deep link without the list in hand.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> },
): Promise<NextResponse> {
  return handle(CONTEXT, async () => {
    const { clientId } = await params;

    // Role, then tenant. The role says "staff"; it never says which tenant.
    const gate = await gateClient(clientId, CONTEXT);
    if (!gate.ok) return gate.response;

    const client = unwrap(await getClientDetail(clientId));
    if (!client) throw notFound(`No client with id "${clientId}".`);

    const body: ClientDetailResponse = {
      client: toClientDto(client),
      sampleData: healthDisclosure(["client.health", "client.metrics", "client.escalation.bucket"]),
    };
    return NextResponse.json(body);
  });
}
