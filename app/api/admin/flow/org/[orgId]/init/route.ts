import { NextRequest, NextResponse } from "next/server";
import { getFramework } from "@/lib/flow/db";
import { seedFlowFramework } from "@/lib/flow/seed";
import { getSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/flow/org/[orgId]/init
 * Initialize flow framework for an org (creates seed data if not exists)
 * Admin only
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !hasAnyRole(session.currentRole, ["tag_exec", "admin"])) {
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
    const frameworkId = await seedFlowFramework(
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
