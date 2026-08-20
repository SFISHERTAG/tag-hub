import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { authorizeOnboardingTrigger } from "@/lib/api/webhook-auth";

/**
 * POST /api/onboarding/phase3-meta-setup
 *
 * Triggers Phase 3 (Meta account setup) for a client.
 * Called after Phase 2 (intake form submission) is complete.
 *
 * Callable by TAG staff or by a machine caller holding
 * PHASE3_WEBHOOK_SECRET. Not callable anonymously.
 *
 * Body:
 * {
 *   "locationId": "string",
 *   "email": "string",
 *   "intakeData": { ... },
 *   "slackChannelId": "string"
 * }
 */
export async function POST(request: NextRequest) {
  const denied = await authorizeOnboardingTrigger("phase3-meta-setup", request, "PHASE3_WEBHOOK_SECRET");
  if (denied) return denied;

  try {
    const body = await request.json();
    const { locationId, email, intakeData, slackChannelId } = body;

    // Validate required fields
    if (!locationId || !email || !intakeData) {
      return NextResponse.json(
        {
          error: "Missing required fields: locationId, email, intakeData",
        },
        { status: 400 }
      );
    }

    console.log(`[API] Triggering Phase 3 for ${locationId}`);

    // Call Cloud Functions webhook
    const functionsUrl = process.env.CLOUD_FUNCTIONS_URL;
    if (!functionsUrl) {
      throw new Error("CLOUD_FUNCTIONS_URL not configured");
    }

    const response = await fetch(`${functionsUrl}/webhook/phase3`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // The functions side has checked for this token since Phase 2.10 and
        // logged a warning on every Phase 3 call because nothing was sending
        // one. Same secret, both directions.
        Authorization: `Bearer ${process.env.PHASE3_WEBHOOK_SECRET}`,
        // Same delivery-identity guarantee as intake-submit's forward to
        // Phase 2 — this route can itself be retried on a transient error.
        // Keyed on the client and contact rather than the whole payload.
        // Hashing `intakeData` too meant a resubmission carrying different
        // data read as a fresh delivery, so the provisioning pipeline would
        // run a second time for the same client. Same client, same contact
        // is the same delivery; a genuinely new intake changes one of them.
        "x-idempotency-key": crypto
          .createHash("sha256")
          .update(JSON.stringify({ phase: "phase3", locationId, email }))
          .digest("hex"),
      },
      body: JSON.stringify({
        locationId,
        email,
        intakeData,
        slackChannelId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("[API] Phase 3 webhook failed:", result);
      return NextResponse.json(result, { status: response.status });
    }

    console.log(`[API] Phase 3 triggered for ${locationId}:`, result);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[API] Error triggering Phase 3:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
