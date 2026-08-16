import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isMetaConfigured, metaMissingConfig } from "@/lib/meta/client";

export const dynamic = "force-dynamic";

/**
 * Reports whether the Meta Marketing API is configured, without making a
 * live API call. Exec-only: this exposes which server env vars are set
 * (names, never values), which is infra visibility, not client data.
 *
 * Deliberately makes no request to Meta. META_SYSTEM_USER_TOKEN doesn't exist
 * yet — Phase 2 of docs/meta-live-launch-plan.md is still open — so every
 * caller of getMetaApi() would throw MetaNotConfiguredError today. This route
 * exists so the dashboard (Story 4.2 AC5) can show a "Meta setup required"
 * notice instead of a stack trace, same as the Slack cubby widget does when
 * SLACK_BOT_TOKEN is unset.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (session.hat !== "tag_exec") {
    return NextResponse.json(
      { error: "Only executives can view Meta integration status." },
      { status: 403 },
    );
  }

  const missing = metaMissingConfig();
  const configured = isMetaConfigured();

  return NextResponse.json({
    configured,
    missing,
    // Not secret (see .env.example) — safe to echo back for a status check.
    businessId: process.env.META_BUSINESS_ID ?? null,
    setupDoc: "docs/meta-live-launch-plan.md",
  });
}
