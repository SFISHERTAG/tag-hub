import { NextResponse, type NextRequest } from "next/server";
import { createCheckbox } from "@/lib/course/db";
import { ROLES } from "@/lib/auth/roles";
import { handle, readJson, requiredString, requireApiRole } from "../../../../../_lib/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/courses/[courseId]/subsections/[subsectionId]/checkboxes
 * Body: { label: string }
 * 201:  { checkboxId: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; subsectionId: string }> },
) {
  const { courseId, subsectionId } = await params;
  const context = `POST /api/admin/courses/${courseId}/subsections/${subsectionId}/checkboxes`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    const body = await readJson(request);
    const checkboxId = await createCheckbox(subsectionId, requiredString(body, "label"));

    return NextResponse.json({ checkboxId }, { status: 201 });
  });
}
