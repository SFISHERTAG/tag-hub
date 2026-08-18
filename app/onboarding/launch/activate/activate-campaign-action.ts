"use server";

import { revalidatePath } from "next/cache";
import { requireSession, getImpersonation } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { activateCampaign } from "@/lib/onboarding/campaign-launch";

type Result = { ok: true; stageName: string } | { ok: false; error: string };

/**
 * Server action wrapper for Story 5.5. Resolves locationId from the CSM's
 * current impersonation session (Story 3.3) and delegates to the single
 * activateCampaign orchestration call site — this action only handles
 * permission-checking and revalidation, never the Meta/GHL/audit sequencing
 * itself.
 */
export async function activateCampaignAction(
  campaignId: string,
  opportunityId: string,
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
