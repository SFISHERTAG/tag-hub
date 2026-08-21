import { NextResponse, type NextRequest } from "next/server";
import { requireApiLocationAccess } from "@/lib/auth/api-session";
import { activateCampaign } from "@/lib/onboarding/campaign-launch";
import { getFulfillmentOpportunity } from "@/lib/ghl/portfolio";
import {
  badRequest,
  handle,
  optionalString,
  readJson,
  requiredString,
  requireApiRole,
} from "../../../admin/_lib/http";
import { ACTIVATION_WARNING, ONBOARDING_ROLES, resolveLocationId } from "../../_launch";

export const dynamic = "force-dynamic";

const CONTEXT = "POST /api/onboarding/campaign-launch/activate";

/**
 * POST /api/onboarding/campaign-launch/activate
 * Body: { campaignId: string, confirmSpend: true,
 *         locationId?: string, opportunityId?: string }
 * 200:  { campaignId, opportunityId, stageId, stageName, activated: true }
 * 400:  confirmSpend missing, or no client / no Fulfillment opportunity
 *
 * Unpauses the campaign in Meta and advances the Fulfillment opportunity to
 * "AP 2 - Ads Launched". **This starts real ad spend.**
 *
 * `confirmSpend: true` is required. It is not ceremony: this endpoint is the
 * only thing standing between a stray POST and a client's ad budget, and a
 * required acknowledgement means activation can never happen as a side effect
 * of a create call, a retry, or a double-submit. The 400 returns
 * ACTIVATION_WARNING, the same sentence the screen shows on its confirm step,
 * so the API and the UI say the same thing.
 *
 * `opportunityId` is optional and resolved from the client's Fulfillment
 * pipeline when omitted, so the launch flow does not have to thread it through
 * two screens of query string.
 *
 * TAG exec / CSM only, plus a location check. `campaignId` is caller-supplied
 * and is verified downstream against the tenant's own Meta ad account listing
 * — without that, a CSM with legitimate access to one client could pass a
 * campaign id seen elsewhere and start a different client's spend, misattributed
 * in the audit log to this location.
 *
 * Meta and GHL do not share a transaction. If the unpause succeeds and the
 * stage move fails, the error says so explicitly: the campaign IS live and
 * only the stage move needs retrying, so nobody relaunches a running campaign.
 */
export async function POST(request: NextRequest) {
  return handle(CONTEXT, async () => {
    const gate = await requireApiRole(ONBOARDING_ROLES, CONTEXT);
    if (!gate.ok) return gate.response;

    const body = await readJson(request);
    if (body.confirmSpend !== true) {
      throw badRequest(`${ACTIVATION_WARNING} Re-send with confirmSpend: true to activate.`);
    }

    const campaignId = requiredString(body, "campaignId");

    const locationId = await resolveLocationId(gate.session, optionalString(body, "locationId"));
    if (!locationId) {
      throw badRequest("No client tenant selected — enter a client before activating.");
    }

    const access = await requireApiLocationAccess(locationId, CONTEXT);
    if (!access.ok) return access.response;

    let opportunityId = optionalString(body, "opportunityId").trim();
    if (!opportunityId) {
      const fulfillment = await getFulfillmentOpportunity(locationId).catch(() => null);
      if (!fulfillment) {
        throw badRequest(
          "No Fulfillment opportunity found for this client — the campaign was NOT activated. " +
            "Create one, then activate.",
        );
      }
      opportunityId = fulfillment.opportunity.id;
    }

    const result = await activateCampaign(locationId, campaignId, opportunityId);

    return NextResponse.json({ ...result, activated: true });
  });
}
