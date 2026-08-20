import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { authorizeOnboardingTrigger } from "@/lib/api/webhook-auth";

/**
 * POST /api/onboarding/intake-submit
 *
 * Receives intake form submission and forwards to Phase 2 Cloud Function.
 * Callable by TAG staff (admin interface) or by a machine caller holding
 * PHASE2_WEBHOOK_SECRET (the GHL webhook). Not callable anonymously: the
 * body names a real client's locationId, and everything downstream of here
 * provisions against that tenant.
 */
export async function POST(request: NextRequest) {
  const denied = await authorizeOnboardingTrigger("intake-submit", request, "PHASE2_WEBHOOK_SECRET");
  if (denied) return denied;

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

    const response = await fetch(phase2Url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PHASE2_WEBHOOK_SECRET}`,
        // A retried fetch (this route's own caller retrying, or a Next.js
        // retry on a transient network error) should be recognized as the
        // same delivery even if body key order or whitespace differs from
        // Phase 2's own content hash of the raw JSON.
        // Keyed on the client and contact rather than the whole payload.
        // Hashing `intakeData` too meant a resubmission carrying different
        // data read as a fresh delivery, so the provisioning pipeline would
        // run a second time for the same client. Same client, same contact
        // is the same delivery; a genuinely new intake changes one of them.
        "x-idempotency-key": crypto
          .createHash("sha256")
          .update(JSON.stringify({ phase: "phase2", locationId, email }))
          .digest("hex"),
      },
      body: JSON.stringify({ locationId, email, intakeData }),
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
