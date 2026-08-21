"use server";

import { revalidatePath } from "next/cache";
import { requireSession, getImpersonation } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { activateCampaign } from "@/lib/onboarding/campaign-launch";
import { getFulfillmentOpportunity } from "@/lib/ghl/portfolio";

type Result = { ok: true; stageName: string } | { ok: false; error: string };

/**
 * Server action wrapper for Story 5.5. Resolves locationId from the CSM's
 * current impersonation session (Story 3.3) and delegates to the single
 * activateCampaign orchestration call site — this action only handles
 * permission-checking and revalidation, never the Meta/GHL/audit sequencing
 * itself.
 *
 * This had zero call sites. Story 5.5 was marked Done while the only button
 * in the flow submitted the create-paused action instead, so every campaign
 * launched through the app stayed paused in Meta indefinitely. ActivateForm
 * now offers activation as an explicit second step, after the paused
 * campaign exists.
 */
export async function activateCampaignAction(
  campaignId: string,
  /**
   * Optional. Resolved from the client's Fulfillment pipeline when omitted,
   * so the launch flow does not have to carry an opportunity id through two
   * pages of query string just to reach this call.
   */
  explicitOpportunityId?: string,
): Promise<Result> {
  const session = await requireSession();
  if (!hasAnyRole(session.currentRole, ["tag_exec", "tag_csm"])) {
    return { ok: false, error: "Not permitted to activate campaigns." };
  }

  const impersonation = await getImpersonation();
  const locationId =
    impersonation && impersonation.actorId === session.uid ? impersonation.locationId : null;
  if (!locationId) {
    return { ok: false, error: "No client tenant selected — enter a client before activating." };
  }

  let opportunityId = explicitOpportunityId;
  if (!opportunityId) {
    const fulfillment = await getFulfillmentOpportunity(locationId).catch(() => null);
    if (!fulfillment) {
      return {
        ok: false,
        error:
          "No Fulfillment opportunity found for this client — the campaign was not activated. " +
          "Create one, then activate.",
      };
    }
    opportunityId = fulfillment.opportunity.id;
  }

  try {
    const result = await activateCampaign(locationId, campaignId, opportunityId);
    revalidatePath("/onboarding");
    return { ok: true, stageName: result.stageName };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
