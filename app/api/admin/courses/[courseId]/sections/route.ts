import { NextResponse, type NextRequest } from "next/server";
import { createSection } from "@/lib/course/db";
import { ROLES } from "@/lib/auth/roles";
import { handle, readJson, requiredString, requireApiRole } from "../../../_lib/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/courses/[courseId]/sections
 * Body: { title: string }
 * 201:  { sectionId: string }
 *
 * Admin only. Display order is assigned server-side from the current count.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;
  const context = `POST /api/admin/courses/${courseId}/sections`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    const body = await readJson(request);
    const sectionId = await createSection(courseId, requiredString(body, "title"));

    return NextResponse.json({ sectionId }, { status: 201 });
  });
}
