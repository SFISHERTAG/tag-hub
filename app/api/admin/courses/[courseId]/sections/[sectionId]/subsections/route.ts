import { NextResponse, type NextRequest } from "next/server";
import { createSubsection } from "@/lib/course/db";
import { ROLES } from "@/lib/auth/roles";
import { handle, readJson, requiredString, requireApiRole } from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/courses/[courseId]/sections/[sectionId]/subsections
 * Body: { title: string }
 * 201:  { subsectionId: string }
 *
 * Admin only. Created with empty content; the editor fills loomId/content
 * through PATCH .../subsections/[subsectionId].
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; sectionId: string }> },
) {
  const { courseId, sectionId } = await params;
  const context = `POST /api/admin/courses/${courseId}/sections/${sectionId}/subsections`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    const body = await readJson(request);
    const subsectionId = await createSubsection(sectionId, {
      title: requiredString(body, "title"),
      content: "",
    });

    return NextResponse.json({ subsectionId }, { status: 201 });
  });
}
