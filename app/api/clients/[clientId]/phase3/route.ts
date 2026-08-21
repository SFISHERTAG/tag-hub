import { NextResponse } from "next/server";
import { getPhase3Status, type Phase3Progress } from "@/lib/dashboard/phase3-status";
import { handle, unwrap } from "../../../dashboard/_lib/http";
import { gateClient } from "../../_lib/gate";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/clients/[clientId]/phase3";

export type ClientPhase3Response = {
  clientId: string;
  /** The location the automation log is keyed on. Null when the client has no GHL sub-account yet. */
  locationId: string | null;
  /** Null means "no Phase 3 event recorded yet", which is a real state, not a failure. */
  phase3: Phase3Progress | null;
};

/**
 * GET /api/clients/[clientId]/phase3
 *
 * Port of legacy/csm-dashboard/actions/get-phase3-status.ts.
 *
 * Behaviour change, deliberate. That action called
 * `getPhase3Status(client.id)`, but `getPhase3Status` queries the automation
 * log by `location_id` (lib/dashboard/phase3-status.ts). A Firestore client
 * document id is not a GHL location id, so the query matched nothing and the
 * Phase 3 tab rendered "pending" for every client regardless of real progress.
 * This resolves the location from the client record and passes that. If a
 * client that previously showed "pending" now shows real progress, this is why.
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
    const { record } = gate;

    if (!record.ghlLocationId) {
      const body: ClientPhase3Response = { clientId, locationId: null, phase3: null };
      return NextResponse.json(body);
    }

    const body: ClientPhase3Response = {
      clientId,
      locationId: record.ghlLocationId,
      phase3: unwrap(await getPhase3Status(record.ghlLocationId)),
    };
    return NextResponse.json(body);
  });
}
