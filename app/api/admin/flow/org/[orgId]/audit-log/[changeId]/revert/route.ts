import { NextRequest, NextResponse } from "next/server";
import { revertChange, getAuditEntry } from "@/lib/flow/db";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/flow/org/[orgId]/audit-log/[changeId]/revert
 * Revert a change by reverting all fields to their previous values
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; changeId: string }> }
) {
  try {
    const session = await requireSession(request);
    if (!session || !["tag_exec", "tag_admin"].includes(session.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { changeId } = await params;

    // Verify the change exists
    const change = await getAuditEntry(changeId);
    if (!change) {
      return NextResponse.json(
        { error: "Change not found" },
        { status: 404 }
      );
    }

    // Perform the revert
    const success = await revertChange(changeId, session.email || "unknown");

    if (!success) {
      return NextResponse.json(
        { error: "Failed to revert change" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Change reverted successfully",
    });
  } catch (error) {
    console.error("Error reverting change:", error);
    return NextResponse.json(
      { error: "Failed to revert change" },
      { status: 500 }
    );
  }
}
