import { NextRequest, NextResponse } from "next/server";
import { revertChange, getAuditEntry } from "@/lib/flow/db";
import { getSession } from "@/lib/auth/session";
import { hasAnyRole, ROLES } from "@/lib/auth/roles";

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
    const session = await getSession();
    if (!session || !hasAnyRole(session.currentRole, [ROLES.TAG_EXEC, ROLES.ADMIN])) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { orgId, changeId } = await params;

    // Verify the change exists, and belongs to the org named in the URL —
    // tag_exec/admin have universal location access so this isn't a tenant
    // isolation gap today, but the URL implies a specific org scope and
    // nothing enforced that a changeId from a different org couldn't be
    // reverted through it.
    const change = await getAuditEntry(changeId);
    if (!change || change.org_id !== orgId) {
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
