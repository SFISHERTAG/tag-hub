import { NextResponse } from "next/server";
import { getAllCourses } from "@/lib/course/data";
import { requireApiSession } from "@/lib/auth/api-session";
import { handle } from "../admin/_lib/http";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/courses";

/**
 * GET /api/courses
 * 200: { courses: Array<{ id, title, description, subsectionCount }> }
 *
 * Any signed-in user. Training is not role-gated — the legacy page only called
 * `requireSession()` — so this checks authentication and nothing further.
 *
 * `subsectionCount` is summed here rather than shipping every section tree to
 * render one count per card.
 */
export async function GET() {
  return handle(CONTEXT, async () => {
    const gate = await requireApiSession(CONTEXT);
    if (!gate.ok) return gate.response;

    const courses = await getAllCourses();

    return NextResponse.json({
      courses: courses.map((course) => ({
        id: course.id,
        title: course.title,
        description: course.description,
        subsectionCount: course.sections.reduce(
          (sum, section) => sum + section.subsections.length,
          0,
        ),
      })),
    });
  });
}
