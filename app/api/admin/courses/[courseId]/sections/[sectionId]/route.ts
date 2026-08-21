import { NextResponse, type NextRequest } from "next/server";
import { deleteSection, updateSection } from "@/lib/course/db";
import { ROLES } from "@/lib/auth/roles";
import { handle, readJson, requiredString, requireApiRole } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/courses/[courseId]/sections/[sectionId]
 * Body: { title: string }
 * 200:  { ok: true }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; sectionId: string }> },
) {
  const { courseId, sectionId } = await params;
  const context = `PATCH /api/admin/courses/${courseId}/sections/${sectionId}`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    const body = await readJson(request);
    await updateSection(sectionId, requiredString(body, "title"));

    return NextResponse.json({ ok: true });
  });
}

/**
 * DELETE /api/admin/courses/[courseId]/sections/[sectionId]
 * 200: { ok: true }
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string; sectionId: string }> },
) {
  const { courseId, sectionId } = await params;
  const context = `DELETE /api/admin/courses/${courseId}/sections/${sectionId}`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    await deleteSection(sectionId);
    return NextResponse.json({ ok: true });
  });
}
