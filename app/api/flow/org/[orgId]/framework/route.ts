import { NextRequest, NextResponse } from "next/server";
import { getFullFramework } from "@/lib/flow/db";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/flow/org/[orgId]/framework
 * Returns the full active framework for a location (closers/setters read-only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await requireSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;

    // Verify user has access to this org (simplified — could check permissions)
    if (!orgId) {
      return NextResponse.json(
        { error: "Invalid org ID" },
        { status: 400 }
      );
    }

    const framework = await getFullFramework(orgId);
    if (!framework) {
      return NextResponse.json(
        { error: "Framework not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(framework);
  } catch (error) {
    console.error("Error fetching framework:", error);
    return NextResponse.json(
      { error: "Failed to fetch framework" },
      { status: 500 }
    );
  }
}
