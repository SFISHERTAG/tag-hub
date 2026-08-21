import { NextResponse } from "next/server";
import { getClientAlerts, type ClientAlert } from "@/lib/dashboard/csm-clients";
import { handle, unwrap } from "../../../dashboard/_lib/http";
import { gateClient } from "../../_lib/gate";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/clients/[clientId]/alerts";

export type ClientAlertsResponse = { clientId: string; alerts: ClientAlert[] };

/**
 * GET /api/clients/[clientId]/alerts
 *
 * Port of legacy/csm-dashboard/actions/get-client-alerts.ts. Newest first,
 * capped at 50 by the lib call. An unresolved alert has no `resolved_at`.
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

    const body: ClientAlertsResponse = {
      clientId,
      alerts: unwrap(await getClientAlerts(clientId)),
    };
    return NextResponse.json(body);
  });
}
