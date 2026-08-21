import { NextRequest, NextResponse } from "next/server";
import { getAuditLog } from "@/lib/flow/db";
import { getSession } from "@/lib/auth/session";
import { hasAnyRole, ROLES } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/flow/org/[orgId]/audit-log
 * Get audit log for a framework (admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !hasAnyRole(session.currentRole, [ROLES.TAG_EXEC, ROLES.ADMIN])) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { orgId } = await params;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const auditLog = await getAuditLog(orgId, limit, offset);

    return NextResponse.json(auditLog);
  } catch (error) {
    console.error("Error fetching audit log:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit log" },
      { status: 500 }
    );
  }
}
