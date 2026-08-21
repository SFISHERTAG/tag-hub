import { NextResponse } from "next/server";
import { CAMPAIGN_TEMPLATES } from "@/lib/onboarding/campaign-templates";
import { handle, requireApiRole } from "../../admin/_lib/http";
import { ACTIVATION_WARNING, ONBOARDING_ROLES } from "../_launch";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/onboarding/campaign-templates";

/**
 * GET /api/onboarding/campaign-templates
 * 200: {
 *   templates: Array<{ id, offerLabel, adSetTargeting, creatives: { id, thumbnailUrl? }[] }>,
 *   activationWarning: string
 * }
 *
 * TAG exec / CSM only. The offer list is hardcoded for MVP; served over HTTP
 * rather than duplicated in the Angular bundle so the two cannot disagree
 * about which offers exist.
 *
 * `activationWarning` ships with the list so the launch screen renders the
 * same sentence the activate endpoint enforces.
 */
export async function GET() {
  return handle(CONTEXT, async () => {
    const gate = await requireApiRole(ONBOARDING_ROLES, CONTEXT);
    if (!gate.ok) return gate.response;

    return NextResponse.json({
      templates: CAMPAIGN_TEMPLATES,
      activationWarning: ACTIVATION_WARNING,
    });
  });
}
