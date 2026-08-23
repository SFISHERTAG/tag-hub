import { NextRequest, NextResponse } from "next/server";
import { createSuggestion, getCardOrgId } from "@/lib/flow/db";
import { getSession, requireLocationAccess } from "@/lib/auth/session";
import { hasAnyRole, ROLES } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

/** Roles that close deals — the people who actually run the script live. */
const SUGGESTER_ROLES = [ROLES.TAG_EXEC, ROLES.CLIENT_CLOSER, ROLES.TAG_SALES] as const;

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

    // Two checks, not one: the caller must have access to the org they
    // claim, AND the card must actually belong to that org — otherwise a
    // caller could pass their own (valid) org_id alongside a different
    // org's cardId and plant a suggestion on a tenant they were never
    // checked against.
    await requireLocationAccess(body.org_id);
    const cardOrgId = await getCardOrgId(cardId);
    if (cardOrgId !== body.org_id) {
      return NextResponse.json(
        { error: "cardId does not belong to org_id" },
        { status: 400 },
      );
    }

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
    if (error instanceof Error && error.message.startsWith("403 Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error creating script suggestion:", error);
    return NextResponse.json({ error: "Failed to create suggestion" }, { status: 500 });
  }
}
