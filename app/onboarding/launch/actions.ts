"use server";

import { requireSession, getImpersonation } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { getCampaignTemplate } from "@/lib/onboarding/campaign-templates";
import {
  createPausedCampaign,
  parseCampaignFormInputs,
} from "@/lib/onboarding/campaign-launch";

type Result = { ok: true; campaignId: string } | { ok: false; error: string };

export async function launchCampaign(formData: FormData): Promise<Result> {
  const session = await requireSession();
  if (!hasAnyRole(session.currentRole, ["tag_exec", "tag_csm"])) {
    return { ok: false, error: "Not permitted to launch campaigns." };
  }

  const parsed = parseCampaignFormInputs({
    client: String(formData.get("client") ?? ""),
    offer: String(formData.get("offer") ?? ""),
    budget: String(formData.get("budget") ?? ""),
    cap: String(formData.get("cap") ?? ""),
    pixel: String(formData.get("pixel") ?? ""),
  });
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const template = getCampaignTemplate(parsed.value.offerId);
  if (!template) return { ok: false, error: "Unknown offer." };

  // Best-effort: if the CSM entered this client via impersonation (Story
  // 3.3), 5.4 can scope creation to that tenant. Free-standing use of this
  // form (no client entered) leaves it null — 5.4's own contract decides
  // whether that's acceptable.
  const impersonation = await getImpersonation();
  const locationId =
    impersonation && impersonation.actorId === session.uid
      ? impersonation.locationId
      : null;

  try {
    const result = await createPausedCampaign(locationId, template.id, parsed.value);
    return { ok: true, campaignId: result.campaignId };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
