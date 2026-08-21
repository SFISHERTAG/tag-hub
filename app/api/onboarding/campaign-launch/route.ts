import { NextResponse, type NextRequest } from "next/server";
import { requireApiLocationAccess } from "@/lib/auth/api-session";
import { createPausedCampaign, parseCampaignFormInputs } from "@/lib/onboarding/campaign-launch";
import { getCampaignTemplate } from "@/lib/onboarding/campaign-templates";
import { badRequest, handle, optionalString, readJson, requireApiRole } from "../../admin/_lib/http";
import {
  ACTIVATION_WARNING,
  ONBOARDING_ROLES,
  readRawCampaignInputs,
  resolveLocationId,
} from "../_launch";

export const dynamic = "force-dynamic";

const CONTEXT = "POST /api/onboarding/campaign-launch";

/**
 * POST /api/onboarding/campaign-launch
 * Body: { client, offer, budget, cap, pixel, locationId? }
 * 201:  { campaignId, adSetId, adIds: string[], status: "paused",
 *         activated: false, locationId, activationWarning }
 *
 * Creates the campaign **paused** in Meta. It does not spend.
 *
 * Activation is a separate call to
 * POST /api/onboarding/campaign-launch/activate, and that separation is the
 * point of this endpoint's shape. Story 5.5's activation had zero call sites
 * because the only button in the flow submitted the create action, so every
 * campaign launched through the app stayed paused in Meta indefinitely.
 * Merging the two would fix that by making the opposite mistake — a form
 * submit that quietly starts real ad spend. `activated: false` is returned
 * explicitly so no client can read a successful create as a live campaign.
 *
 * TAG exec / CSM only. `locationId` comes from the body or the impersonation
 * cookie and is checked against the session before creation, which is what
 * scopes creation to that tenant's Meta ad account and audit log.
 *
 * The underlying call is idempotent on identical inputs: a repeat returns the
 * campaign already created rather than making a second one in Meta.
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

    const locationId = await resolveLocationId(gate.session, optionalString(body, "locationId"));
    if (!locationId) {
      throw badRequest(
        "No client selected — enter a client before launching, so creation targets that " +
          "client's Meta ad account and audit log.",
      );
    }

    const access = await requireApiLocationAccess(locationId, CONTEXT);
    if (!access.ok) return access.response;

    const result = await createPausedCampaign(locationId, template.id, parsed.value);

    return NextResponse.json(
      {
        ...result,
        activated: false,
        locationId,
        activationWarning: ACTIVATION_WARNING,
      },
      { status: 201 },
    );
  });
}
