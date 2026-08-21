import "server-only";
import type { NextRequest } from "next/server";
import {
  getFollowUpConfig,
  saveFollowUpConfig,
  type FollowUpConfig,
  type FollowUpThresholdMode,
} from "@/lib/ghl/store";
import { getImpersonation } from "@/lib/auth/session";
import { logAction } from "@/lib/audit/store";
import {
  canConfigureFollowUp,
  gateLocation,
  requireFollowUpConfigRole,
} from "@/app/api/ghl/_lib/gate";
import { badRequest, ghlJson, readJsonBody } from "@/app/api/ghl/_lib/respond";

export const dynamic = "force-dynamic";

const GET_CONTEXT = "GET /api/ghl/locations/[locationId]/follow-up/config";
const PUT_CONTEXT = "PUT /api/ghl/locations/[locationId]/follow-up/config";

const MODES = ["days", "attempts"] as const satisfies readonly FollowUpThresholdMode[];

/** Ten years of days, or ten years of daily attempts. Not a product rule — a
 * ceiling, so a mistyped threshold cannot be stored as something no queue can
 * ever age out of. */
const MAX_THRESHOLD = 3650;

export type FollowUpConfigResponse = {
  config: FollowUpConfig;
  /** Cosmetic gating hint for the client. PUT re-checks the role itself. */
  canConfigure: boolean;
};

export type UpdateFollowUpConfigRequest = FollowUpConfig;

/** GET /api/ghl/locations/[locationId]/follow-up/config */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> },
) {
  const { locationId } = await params;
  const gate = await gateLocation(locationId, GET_CONTEXT);
  if (!gate.ok) return gate.response;

  return ghlJson<FollowUpConfigResponse>(GET_CONTEXT, async () => ({
    config: await getFollowUpConfig(locationId),
    canConfigure: canConfigureFollowUp(gate.session),
  }));
}

/**
 * PUT /api/ghl/locations/[locationId]/follow-up/config
 *
 * Ports `setFollowUpConfig`. Two checks, in this order and both server-side:
 * the caller must reach this tenant at all, and their current hat must be one
 * that manages closers. Hiding the control in the UI is not one of them.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> },
) {
  const { locationId } = await params;
  const gate = await gateLocation(locationId, PUT_CONTEXT);
  if (!gate.ok) return gate.response;

  const denied = requireFollowUpConfigRole(gate.session, PUT_CONTEXT);
  if (denied) return denied;

  const body = await readJsonBody(request);
  if (!body) return badRequest(PUT_CONTEXT, "Expected a JSON object body.");

  const mode = body.mode;
  if (typeof mode !== "string" || !MODES.includes(mode as FollowUpThresholdMode)) {
    return badRequest(PUT_CONTEXT, `mode must be one of: ${MODES.join(", ")}.`);
  }

  const value = body.value;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > MAX_THRESHOLD
  ) {
    return badRequest(
      PUT_CONTEXT,
      `value must be a positive number no greater than ${MAX_THRESHOLD}.`,
    );
  }

  const config: FollowUpConfig = { mode: mode as FollowUpThresholdMode, value };

  return ghlJson<FollowUpConfigResponse>(PUT_CONTEXT, async () => {
    await saveFollowUpConfig(locationId, config);

    // A threshold change silently re-shapes every closer's queue, so it is
    // attributed the same way a stage move is: to the acting user, linked to
    // the impersonation session when one is active.
    const impersonation = await getImpersonation();
    await logAction(locationId, {
      actorId: gate.session.uid,
      actorRole: gate.session.currentRole,
      action: "follow_up_config.update",
      targetType: "location",
      targetId: locationId,
      auditEntryId: impersonation?.auditEntryId,
      metadata: { mode: config.mode, value: config.value },
    });

    return { config, canConfigure: true };
  });
}
