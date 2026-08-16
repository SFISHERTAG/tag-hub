import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/onboarding/phase3-meta-setup
 *
 * Triggers Phase 3 (Meta account setup) for a client.
 * Called after Phase 2 (intake form submission) is complete.
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
