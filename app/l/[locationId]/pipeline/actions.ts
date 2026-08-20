"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getSession, getImpersonation } from "@/lib/auth/session";
import { updateOpportunityStage, closeOpportunity } from "@/lib/ghl/opportunities";
import { getContact } from "@/lib/ghl/contacts";
import { logAction } from "@/lib/audit/store";
import { parseFulfillmentStage, STAGE_TASKS } from "@/lib/onboarding/stage-tasks";
import { completeStageTasks } from "@/lib/onboarding/store";
import { dispatchClosedWon } from "@/lib/meta/conversions";

export async function moveOpportunityStagAction(
  locationId: string,
  opportunityId: string,
  pipelineStageId: string,
  /** Name of the stage being left, if known — used to auto-complete its onboarding tasks (AC4). */
  previousStageName?: string,
): Promise<{ ok: true; lastStageChangeAt: string } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Not signed in." };
  }

  try {
    const result = await updateOpportunityStage(locationId, opportunityId, pipelineStageId);
    // Logged with the acting user's id, not the impersonated client's — a
    // CSM working inside a client's tenant (Story 3.3) must still show up
    // as themselves in the audit trail. See docs/stories/3.4. auditEntryId
    // links this write back to the impersonation session that produced it
    // (Story 3.5 AC4), when one is active.
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

    // Advancing past a Fulfillment stage closes that stage's onboarding
    // tasks (story 5.1, AC4) — stage names (PR1-AP5) are unique to that
    // pipeline, so matching against the fixed task map is enough to tell
    // this apart from a Sales-pipeline move without threading a pipeline id.
    const previousStage = parseFulfillmentStage(previousStageName);
    if (previousStage) {
      await completeStageTasks(
        locationId,
        opportunityId,
        STAGE_TASKS[previousStage].map((task) => task.id),
      );
    }

    revalidatePath(`/l/${locationId}/pipeline`);
    revalidatePath(`/onboarding`);
    return { ok: true, ...result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function closeOpportunityAction(
  locationId: string,
  opportunityId: string,
  status: "won" | "lost",
  monetaryValue: number,
  /** Present when the board already has the contact id in scope (Story 6.3 dispatch). */
  contactId?: string,
): Promise<{ ok: true; status: string; monetaryValue: number } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Not signed in." };
  }

  try {
    const result = await closeOpportunity(locationId, opportunityId, status, monetaryValue);
    const impersonation = await getImpersonation();
    await logAction(locationId, {
      actorId: session.uid,
      actorRole: session.currentRole,
      action: "opportunity.close",
      targetType: "opportunity",
      targetId: opportunityId,
      auditEntryId: impersonation?.auditEntryId,
      metadata: { status, monetaryValue },
    });

    // Story 6.3: teach Meta's algorithm the deal's value, not just that a
    // close happened. Scheduled via after() so a Meta outage can never slow
    // down or fail the close above, which is the closer's actual work — same
    // non-blocking contract as Story 6.2's dispatchShowed.
    if (status === "won" && contactId) {
      after(async () => {
        const contact = await getContact(locationId, contactId);
        if (contact) {
          await dispatchClosedWon(locationId, opportunityId, contact, result.monetaryValue);
        }
      });
    }

    revalidatePath(`/l/${locationId}/pipeline`);
    return { ok: true, ...result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
