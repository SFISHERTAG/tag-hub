import { NextRequest, NextResponse } from "next/server";
import { signHmacPayload } from "@/lib/webhooks/signature";

/**
 * POST /api/onboarding/intake-submit
 *
 * Receives intake form submission and forwards to Phase 2 Cloud Function.
 * This endpoint can be:
 * 1. Called directly from a form (client-side)
 * 2. Triggered by GHL webhook
 * 3. Called manually from admin interface
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { locationId, email, intakeData } = body;

    if (!locationId || !email || !intakeData) {
      return NextResponse.json(
        { error: "Missing required fields: locationId, email, intakeData" },
        { status: 400 }
      );
    }

    // Forward to Phase 2 Cloud Function
    const phase2Url = process.env.PHASE2_WEBHOOK_URL;
    if (!phase2Url) {
      console.error("PHASE2_WEBHOOK_URL not configured");
      return NextResponse.json(
        { error: "Provisioning service not configured" },
        { status: 500 }
      );
    }

    const hmacSecret = process.env.GHL_WEBHOOK_HMAC_SECRET;
    if (!hmacSecret) {
      console.error("GHL_WEBHOOK_HMAC_SECRET not configured");
      return NextResponse.json(
        { error: "Provisioning service not configured" },
        { status: 500 }
      );
    }

    // Phase 2 now requires the same signature GHL itself would send (see
    // functions/src/webhooks/signature.ts) — sign the exact string sent
    // as the body, since verification is byte-for-byte over the raw body.
    const payload = JSON.stringify({ locationId, email, intakeData });
    const response = await fetch(phase2Url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PHASE2_WEBHOOK_SECRET}`,
        "x-ghl-signature": signHmacPayload(payload, hmacSecret),
      },
      body: payload,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Phase 2 webhook error: ${error}`);
      return NextResponse.json(
        { error: "Failed to process intake submission" },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      documentId: result.googleDocId,
      message: "Intake received. Document being prepared.",
    });
  } catch (error) {
    console.error("Intake submission error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
