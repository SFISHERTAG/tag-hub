import { NextRequest, NextResponse } from "next/server";
import { runMetaRetryJob } from "@/lib/meta/retry";

/**
 * POST /api/cron/meta-retry
 *
 * Story 6.5: hourly Cloud Scheduler target. Retries failed Meta Conversions
 * API dispatches from the last 24h, up to lib/meta/conversions.ts's
 * MAX_ATTEMPTS, escalating to a dead-letter record (+ optional Slack alert)
 * once exhausted.
 *
 * Authenticated with a shared secret rather than a user session — Cloud
 * Scheduler has no Firebase session to present. Mirrors the bearer-secret
 * pattern in app/api/onboarding/intake-submit/route.ts.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/meta-retry] CRON_SECRET not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runMetaRetryJob();
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error("[cron/meta-retry] job failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
