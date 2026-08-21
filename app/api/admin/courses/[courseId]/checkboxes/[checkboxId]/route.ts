import { NextResponse, type NextRequest } from "next/server";
import { deleteCheckbox, updateCheckbox } from "@/lib/course/db";
import { ROLES } from "@/lib/auth/roles";
import { handle, readJson, requiredString, requireApiRole } from "../../../../_lib/http";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/courses/[courseId]/checkboxes/[checkboxId]
 * Body: { label: string }
 * 200:  { ok: true }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; checkboxId: string }> },
) {
  const { courseId, checkboxId } = await params;
  const context = `PATCH /api/admin/courses/${courseId}/checkboxes/${checkboxId}`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    const body = await readJson(request);
    await updateCheckbox(checkboxId, requiredString(body, "label"));

    return NextResponse.json({ ok: true });
  });
}

/**
 * DELETE /api/admin/courses/[courseId]/checkboxes/[checkboxId]
 * 200: { ok: true }
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string; checkboxId: string }> },
) {
  const { courseId, checkboxId } = await params;
  const context = `DELETE /api/admin/courses/${courseId}/checkboxes/${checkboxId}`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    await deleteCheckbox(checkboxId);
    return NextResponse.json({ ok: true });
  });
}
