import { NextRequest, NextResponse } from "next/server";
import { getSuggestionsForOrg } from "@/lib/flow/db";
import { getSession, requireLocationAccess } from "@/lib/auth/session";
import { hasAnyRole, ROLES } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

const REVIEWER_ROLES = [ROLES.TAG_EXEC, ROLES.TAG_SALES_MANAGER] as const;

/**
 * GET /api/flow/org/[orgId]/suggestions?status=pending
 * Sales-manager review queue. status defaults to "pending" — pass
 * status=approved|rejected to see history, or omit the filter via status=all.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const session = await getSession();
    if (!session || !hasAnyRole(session.currentRole, REVIEWER_ROLES)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { orgId } = await params;
    await requireLocationAccess(orgId);

    const statusParam = request.nextUrl.searchParams.get("status") ?? "pending";
    const status =
      statusParam === "all" ? undefined : (statusParam as "pending" | "approved" | "rejected");

    const suggestions = await getSuggestionsForOrg(orgId, status);
    return NextResponse.json(suggestions);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("403 Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error fetching script suggestions:", error);
    return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
  }
}
