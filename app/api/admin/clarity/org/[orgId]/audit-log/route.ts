import { NextRequest, NextResponse } from "next/server";
import { getAuditLog } from "@/lib/clarity/db";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/clarity/org/[orgId]/audit-log
 * Get audit log for a framework (admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await requireSession(request);
    if (!session || !["tag_exec", "tag_admin"].includes(session.role || "")) {
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
