import { NextRequest, NextResponse } from "next/server";
import { getFramework } from "@/lib/clarity/db";
import { seedClarityFramework } from "@/lib/clarity/seed";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/clarity/org/[orgId]/init
 * Initialize clarity framework for an org (creates seed data if not exists)
 * Admin only
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await requireSession(request);
    if (!session || !["tag_exec", "tag_admin"].includes(session.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { orgId } = await params;

    // Check if framework already exists
    const existing = await getFramework(orgId);
    if (existing) {
      return NextResponse.json(
        {
          message: "Framework already exists",
          framework: existing,
        },
        { status: 200 }
      );
    }

    // Seed the framework
    const frameworkId = await seedClarityFramework(
      orgId,
      session.email || "system"
    );

    const framework = await getFramework(orgId);

    return NextResponse.json(
      {
        message: "Framework initialized successfully",
        framework,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error initializing framework:", error);
    return NextResponse.json(
      { error: "Failed to initialize framework" },
      { status: 500 }
    );
  }
}
