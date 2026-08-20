import { NextRequest, NextResponse } from "next/server";
import { createSuggestion } from "@/lib/flow/db";
import { getSession, requireOwnedLocation } from "@/lib/auth/session";
import { toErrorResponse } from "@/lib/api/route-guard";
import { hasAnyRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

/** Roles that close deals — the people who actually run the script live. */
const SUGGESTER_ROLES = ["tag_exec", "client_closer", "tag_sales"] as const;

interface SuggestionPayload {
  org_id: string;
  suggested_content: string;
  suggested_why?: string;
  suggested_notes?: string;
  suggestion_note?: string;
}

/**
 * POST /api/flow/card/[cardId]/suggestions
 * A closer proposes a script edit for a sales manager to review — unlike
 * /api/admin/flow/card/[cardId]/scripts, this never changes what other
 * closers see until someone with review access approves it.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> },
) {
  try {
    const session = await getSession();
    if (!session || !hasAnyRole(session.currentRole, SUGGESTER_ROLES)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { cardId } = await params;
    const body: SuggestionPayload = await request.json();

    if (!body.org_id || !body.suggested_content?.trim()) {
      return NextResponse.json(
        { error: "org_id and suggested_content are required" },
        { status: 400 },
      );
    }

    // org_id arrives in the request body, so it is caller-supplied like any
    // path parameter — without this check a closer can file a suggestion
    // against another tenant's card and have it approved onto their live
    // framework.
    await requireOwnedLocation(body.org_id);

    const suggestion = await createSuggestion(cardId, {
      org_id: body.org_id,
      suggested_content: body.suggested_content,
      suggested_why: body.suggested_why,
      suggested_notes: body.suggested_notes,
      suggestion_note: body.suggestion_note,
      suggested_by: session.email || "unknown",
    });

    return NextResponse.json(suggestion, { status: 201 });
  } catch (error) {
    const denied = toErrorResponse(error);
    if (denied) return denied;
    console.error("Error creating script suggestion:", error);
    return NextResponse.json({ error: "Failed to create suggestion" }, { status: 500 });
  }
}
