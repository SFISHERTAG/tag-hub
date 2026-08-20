import { NextRequest, NextResponse } from "next/server";
import { getFullFramework } from "@/lib/flow/db";
import { requireOwnedLocation } from "@/lib/auth/session";
import { toErrorResponse } from "@/lib/api/route-guard";

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
    const { orgId } = await params;

    if (!orgId) {
      return NextResponse.json({ error: "Invalid org ID" }, { status: 400 });
    }

    // `orgId` is a GHL location id (see app/closer/flow/page.tsx, which
    // derives it from the session). A closer holds a legitimate role for
    // exactly one tenant, so the role alone says nothing about whether this
    // org is theirs — without this the whole of another paying client's
    // sales-closing script set is one URL edit away.
    await requireOwnedLocation(orgId);

    const framework = await getFullFramework(orgId);
    if (!framework) {
      return NextResponse.json(
        { error: "Framework not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(framework);
  } catch (error) {
    const denied = toErrorResponse(error);
    if (denied) return denied;
    console.error("Error fetching framework:", error);
    return NextResponse.json(
      { error: "Failed to fetch framework" },
      { status: 500 }
    );
  }
}
