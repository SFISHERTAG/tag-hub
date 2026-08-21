import { NextResponse, type NextRequest } from "next/server";
import { deleteSubsection, updateSubsection } from "@/lib/course/db";
import { ROLES } from "@/lib/auth/roles";
import {
  handle,
  optionalString,
  readJson,
  requiredString,
  requireApiRole,
} from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/courses/[courseId]/subsections/[subsectionId]
 * Body: { title: string, loomId?: string, content?: string }
 * 200:  { ok: true }
 *
 * Admin only. `content` is passed through unrimmed on purpose — it is prose and
 * its blank lines are the paragraph breaks the viewer renders.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; subsectionId: string }> },
) {
  const { courseId, subsectionId } = await params;
  const context = `PATCH /api/admin/courses/${courseId}/subsections/${subsectionId}`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    const body = await readJson(request);
    await updateSubsection(subsectionId, {
      title: requiredString(body, "title"),
      loomId: optionalString(body, "loomId").trim(),
      content: optionalString(body, "content"),
    });

    return NextResponse.json({ ok: true });
  });
}

/**
 * DELETE /api/admin/courses/[courseId]/subsections/[subsectionId]
 * 200: { ok: true }
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string; subsectionId: string }> },
) {
  const { courseId, subsectionId } = await params;
  const context = `DELETE /api/admin/courses/${courseId}/subsections/${subsectionId}`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    await deleteSubsection(subsectionId);
    return NextResponse.json({ ok: true });
  });
}
