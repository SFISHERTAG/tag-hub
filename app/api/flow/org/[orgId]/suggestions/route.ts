import { NextRequest, NextResponse } from "next/server";
import { getSuggestionsForOrg } from "@/lib/flow/db";
import { getSession, requireOwnedLocation } from "@/lib/auth/session";
import { toErrorResponse } from "@/lib/api/route-guard";
import { hasAnyRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

const REVIEWER_ROLES = ["tag_exec", "tag_sales_manager"] as const;

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
    // Reviewer role is necessary but not sufficient — a sales manager
    // reviews their own org's queue, not every tenant's.
    await requireOwnedLocation(orgId);

    const statusParam = request.nextUrl.searchParams.get("status") ?? "pending";
    const status =
      statusParam === "all" ? undefined : (statusParam as "pending" | "approved" | "rejected");

    const suggestions = await getSuggestionsForOrg(orgId, status);
    return NextResponse.json(suggestions);
  } catch (error) {
    const denied = toErrorResponse(error);
    if (denied) return denied;
    console.error("Error fetching script suggestions:", error);
    return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
  }
}
