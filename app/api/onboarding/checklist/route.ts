import { NextResponse, type NextRequest } from "next/server";
import { requireApiLocationAccess } from "@/lib/auth/api-session";
import { daysSince } from "@/lib/ghl/opportunities";
import { getFulfillmentOpportunity } from "@/lib/ghl/portfolio";
import { getTenant } from "@/lib/ghl/tenants";
import { isClientUser } from "@/lib/dashboard/location-selection";
import {
  FULFILLMENT_STAGE_ORDER,
  STAGE_TASKS,
  parseFulfillmentStage,
} from "@/lib/onboarding/stage-tasks";
import { loadCompletedTasks } from "@/lib/onboarding/store";
import { handle, requireApiRole } from "../../admin/_lib/http";
import { ONBOARDING_ROLES, resolveLocationId } from "../_launch";

export const dynamic = "force-dynamic";

/**
 * GET /api/onboarding/checklist?locationId=<optional>
 *
 * 200, one of three discriminated shapes:
 *
 *   { state: "no-client", stageOrder: string[] }
 *     No client selected and no impersonation in effect.
 *
 *   { state: "no-opportunity", locationId, tenantName, stageOrder }
 *     Client resolved, but they have no Fulfillment opportunity yet.
 *
 *   { state: "ready", locationId, tenantName, opportunityId,
 *     stage: "PR1".."AP5" | null, stageName: string | null,
 *     daysInStage: number | null, tasks: { id, label }[],
 *     completedTaskIds: string[], readOnly: boolean, stageOrder: string[] }
 *
 * Three states rather than an error for the first two: "no client selected"
 * and "this client has no opportunity yet" are ordinary situations with their
 * own copy, and collapsing them into a 4xx would make the screen render a
 * failure over a perfectly normal state.
 *
 * `stage` is null when GHL's stage name does not parse. GHL labels a stage
 * "AP 2 - Ads Launched", not "AP2", so an exact match never hit and every
 * client past PR1 got an empty checklist — `parseFulfillmentStage` is what
 * fixes that, and it stays in lib/ so this endpoint and any other reader agree.
 *
 * TAG exec / CSM only, plus a location-access check on whatever id resolves.
 */
export async function GET(request: NextRequest) {
  const context = "GET /api/onboarding/checklist";

  return handle(context, async () => {
    const gate = await requireApiRole(ONBOARDING_ROLES, context);
    if (!gate.ok) return gate.response;

    const stageOrder = [...FULFILLMENT_STAGE_ORDER];
    const requested = new URL(request.url).searchParams.get("locationId");
    const locationId = await resolveLocationId(gate.session, requested);
    if (!locationId) {
      return NextResponse.json({ state: "no-client", stageOrder });
    }

    const access = await requireApiLocationAccess(locationId, context);
    if (!access.ok) return access.response;

    const [tenant, fulfillment] = await Promise.all([
      getTenant(locationId),
      getFulfillmentOpportunity(locationId),
    ]);

    if (!fulfillment) {
      return NextResponse.json({
        state: "no-opportunity",
        locationId,
        tenantName: tenant.name,
        stageOrder,
      });
    }

    const { opportunity, stageName } = fulfillment;
    const stage = parseFulfillmentStage(stageName);
    const tasks = stage ? STAGE_TASKS[stage] : [];
    const completed = await loadCompletedTasks(locationId, opportunity.id);

    return NextResponse.json({
      state: "ready",
      locationId,
      tenantName: tenant.name,
      opportunityId: opportunity.id,
      stage,
      stageName,
      daysInStage: daysSince(opportunity.lastStageChangeAt ?? opportunity.updatedAt),
      tasks,
      completedTaskIds: [...completed],
      readOnly: isClientUser(access.session.currentRole),
      stageOrder,
    });
  });
}
