import { NextRequest, NextResponse } from "next/server";
import { getSuggestion, resolveSuggestion } from "@/lib/flow/db";
import { getSession, requireLocationAccess } from "@/lib/auth/session";
import { hasAnyRole, ROLES } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

const REVIEWER_ROLES = [ROLES.TAG_EXEC, ROLES.TAG_SALES_MANAGER] as const;

interface ResolvePayload {
  action: "approve" | "reject";
  review_note?: string;
}

/**
 * POST /api/flow/suggestions/[suggestionId]/resolve
 * Approve (writes a new script version + audit log entry, same as a direct
 * admin edit) or reject (no framework change) a pending suggestion.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ suggestionId: string }> },
) {
  try {
    const session = await getSession();
    if (!session || !hasAnyRole(session.currentRole, REVIEWER_ROLES)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { suggestionId } = await params;
    const body: ResolvePayload = await request.json();

    if (body.action !== "approve" && body.action !== "reject") {
      return NextResponse.json(
        { error: 'action must be "approve" or "reject"' },
        { status: 400 },
      );
    }

    // suggestionId alone doesn't carry an org — look the suggestion up first
    // so a reviewer can only resolve suggestions against orgs they actually
    // have access to, not just any id they can guess or enumerate.
    const suggestion = await getSuggestion(suggestionId);
    if (!suggestion) {
      return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
    }
    await requireLocationAccess(suggestion.org_id);

    const resolved = await resolveSuggestion(
      suggestionId,
      body.action,
      session.email || "unknown",
      body.review_note,
    );

    return NextResponse.json(resolved);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("403 Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error resolving script suggestion:", error);
    const message = error instanceof Error ? error.message : "Failed to resolve suggestion";
    const status = message.includes("not found") ? 404 : message.includes("already") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
