import { NextRequest, NextResponse } from "next/server";
import { getFullFramework } from "@/lib/flow/db";
import { getSession, requireLocationAccess } from "@/lib/auth/session";

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
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;

    if (!orgId) {
      return NextResponse.json(
        { error: "Invalid org ID" },
        { status: 400 }
      );
    }

    // orgId here is a GHL location id: callers (see app/closer/flow/page.tsx)
    // pass getLocationForDashboard(session), the same id requireLocationAccess
    // checks everywhere else. The session was already confirmed above, so
    // requireLocationAccess's internal getSession() call cannot hit its
    // redirect-to-signin branch here. A denied session throws a plain Error,
    // which we catch and turn into a 403 instead of the redirect() that
    // helper uses for page routes (wrong for a JSON API).
    try {
      await requireLocationAccess(orgId);
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
