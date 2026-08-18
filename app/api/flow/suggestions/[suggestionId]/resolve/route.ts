import { NextRequest, NextResponse } from "next/server";
import { resolveSuggestion } from "@/lib/flow/db";
import { getSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

const REVIEWER_ROLES = ["tag_exec", "tag_sales_manager"] as const;

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

    const resolved = await resolveSuggestion(
      suggestionId,
      body.action,
      session.email || "unknown",
      body.review_note,
    );

    return NextResponse.json(resolved);
  } catch (error) {
    console.error("Error resolving script suggestion:", error);
    const message = error instanceof Error ? error.message : "Failed to resolve suggestion";
    const status = message.includes("not found") ? 404 : message.includes("already") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
