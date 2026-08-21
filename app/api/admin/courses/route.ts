import { NextResponse } from "next/server";
import { listCourseSummaries } from "@/lib/course/db";
import { ROLES } from "@/lib/auth/roles";
import { handle, requireApiRole } from "../_lib/http";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/admin/courses";

/**
 * GET /api/admin/courses
 * 200: { courses: CourseSummary[] }  // { id, slug, title, description }
 *
 * Admin only.
 */
export async function GET() {
  return handle(CONTEXT, async () => {
    const gate = await requireApiRole([ROLES.ADMIN], CONTEXT);
    if (!gate.ok) return gate.response;

    return NextResponse.json({ courses: await listCourseSummaries() });
  });
}
