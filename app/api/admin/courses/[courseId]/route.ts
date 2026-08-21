import { NextResponse, type NextRequest } from "next/server";
import { getCourseById, updateCourseMeta } from "@/lib/course/db";
import { ROLES } from "@/lib/auth/roles";
import {
  handle,
  notFound,
  optionalString,
  readJson,
  requiredString,
  requireApiRole,
} from "../../_lib/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/courses/[courseId]
 * 200: { course: Course }   // full section -> subsection -> checkbox tree
 * 404: course does not exist
 *
 * Admin only. Looked up by id (not slug) — this is the editor's view.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;
  const context = `GET /api/admin/courses/${courseId}`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    const course = await getCourseById(courseId);
    if (!course) throw notFound("Course not found.");

    return NextResponse.json({ course });
  });
}

/**
 * PATCH /api/admin/courses/[courseId]
 * Body: { title: string, description?: string }
 * 200:  { ok: true }
 *
 * Admin only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;
  const context = `PATCH /api/admin/courses/${courseId}`;

  return handle(context, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], context);
    if (!gate.ok) return gate.response;

    const body = await readJson(request);
    await updateCourseMeta(courseId, {
      title: requiredString(body, "title"),
      description: optionalString(body, "description").trim(),
    });

    return NextResponse.json({ ok: true });
  });
}
