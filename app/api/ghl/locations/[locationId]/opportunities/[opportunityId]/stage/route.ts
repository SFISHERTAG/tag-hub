import "server-only";
import type { NextRequest } from "next/server";
import { getImpersonation } from "@/lib/auth/session";
import { updateOpportunityStage } from "@/lib/ghl/opportunities";
import { logAction } from "@/lib/audit/store";
import { parseFulfillmentStage, STAGE_TASKS } from "@/lib/onboarding/stage-tasks";
import { completeStageTasks } from "@/lib/onboarding/store";
import { gateLocationAndId } from "@/app/api/ghl/_lib/gate";
import { badRequest, ghlJson, readJsonBody } from "@/app/api/ghl/_lib/respond";

export const dynamic = "force-dynamic";

const CONTEXT = "PUT /api/ghl/locations/[locationId]/opportunities/[opportunityId]/stage";

export type MoveStageRequest = {
  pipelineStageId: string;
  /** Name of the stage being left, when the board knows it. Drives AC4's
   * auto-completion of that Fulfillment stage's onboarding tasks. */
  previousStageName?: string;
};

export type MoveStageResponse = {
  opportunityId: string;
  pipelineStageId: string;
  lastStageChangeAt: string;
  /** Onboarding task ids closed by leaving a Fulfillment stage. Empty for a Sales-pipeline move. */
  completedTaskIds: string[];
};

/**
 * PUT /api/ghl/locations/[locationId]/opportunities/[opportunityId]/stage
 *
 * Ports `moveOpportunityStagAction`. The legacy action checked only that
 * someone was signed in, which let any authenticated caller move a card in any
 * tenant by naming its locationId — the ownership check is the substantive
 * change in this port, not the transport.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; opportunityId: string }> },
) {
  const { locationId, opportunityId } = await params;
  const gate = await gateLocationAndId(locationId, opportunityId, "opportunity", CONTEXT);
  if (!gate.ok) return gate.response;
  const { session } = gate;

  const body = await readJsonBody(request);
  if (!body) return badRequest(CONTEXT, "Expected a JSON object body.");

  const pipelineStageId = body.pipelineStageId;
  if (typeof pipelineStageId !== "string" || pipelineStageId.trim() === "") {
    return badRequest(CONTEXT, "pipelineStageId is required.");
  }

  const previousStageName =
    typeof body.previousStageName === "string" ? body.previousStageName : undefined;

  return ghlJson<MoveStageResponse>(CONTEXT, async () => {
    const result = await updateOpportunityStage(locationId, opportunityId, pipelineStageId);

    // Logged with the acting user's id, not the impersonated client's — a CSM
    // working inside a client's tenant must still show up as themselves.
    // auditEntryId links the write back to the impersonation session that
    // produced it, when one is active.
    const impersonation = await getImpersonation();
    await logAction(locationId, {
      actorId: session.uid,
      actorRole: session.currentRole,
      action: "opportunity.stage_change",
      targetType: "opportunity",
      targetId: opportunityId,
      auditEntryId: impersonation?.auditEntryId,
      metadata: { pipelineStageId },
    });

    // Advancing past a Fulfillment stage closes that stage's onboarding tasks
    // (Story 5.1 AC4). Stage names (PR1-AP5) are unique to that pipeline, so
    // matching the fixed task map is enough to tell this apart from a
    // Sales-pipeline move without threading a pipeline id through.
    const previousStage = parseFulfillmentStage(previousStageName);
    const completedTaskIds = previousStage
      ? STAGE_TASKS[previousStage].map((task) => task.id)
      : [];
    if (completedTaskIds.length > 0) {
      await completeStageTasks(locationId, opportunityId, completedTaskIds);
    }

    return {
      opportunityId,
      pipelineStageId,
      lastStageChangeAt: result.lastStageChangeAt,
      completedTaskIds,
    };
  });
}
