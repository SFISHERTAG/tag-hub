import { NextResponse, type NextRequest } from "next/server";
import { parseCampaignFormInputs } from "@/lib/onboarding/campaign-launch";
import { getCampaignTemplate } from "@/lib/onboarding/campaign-templates";
import { badRequest, handle, readJson, requireApiRole } from "../../../admin/_lib/http";
import { ACTIVATION_WARNING, ONBOARDING_ROLES, readRawCampaignInputs } from "../../_launch";

export const dynamic = "force-dynamic";

const CONTEXT = "POST /api/onboarding/campaign-launch/preview";

/**
 * POST /api/onboarding/campaign-launch/preview
 * Body: { client, offer, budget, cap, pixel }   // all raw strings, as typed
 * 200:  { campaign: { clientName, offerId, monthlyBudget, dailyCap, pixelId },
 *         template: CampaignTemplate, activationWarning: string }
 * 400:  the specific validation message
 *
 * Validation only. Creates nothing, touches Meta not at all, and is safe to
 * call on every keystroke.
 *
 * It exists so the budget and daily-cap rules stay in
 * `parseCampaignFormInputs` — one implementation, shared by the form, the
 * review screen and the create call — instead of being re-expressed in Angular
 * validators that then drift from what the server will actually accept.
 */
export async function POST(request: NextRequest) {
  return handle(CONTEXT, async () => {
    const gate = await requireApiRole(ONBOARDING_ROLES, CONTEXT);
    if (!gate.ok) return gate.response;

    const body = await readJson(request);
    const parsed = parseCampaignFormInputs(readRawCampaignInputs(body));
    if (!parsed.ok) throw badRequest(parsed.error);

    const template = getCampaignTemplate(parsed.value.offerId);
    if (!template) throw badRequest("Unknown offer.");

    return NextResponse.json({
      campaign: parsed.value,
      template,
      activationWarning: ACTIVATION_WARNING,
    });
  });
}
