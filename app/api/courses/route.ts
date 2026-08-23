import { NextResponse } from "next/server";
import { getAllCourses } from "@/lib/course/data";
import { requireApiSession } from "@/lib/auth/api-session";
import { canSeeCourse, canSeeSubsection } from "@/lib/course/visibility";
import { handle } from "../admin/_lib/http";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/courses";

/**
 * GET /api/courses
 * 200: { courses: Array<{ id, title, description, subsectionCount }> }
 *
 * Signed in, and the course's audience includes the caller's current hat. A
 * course with no stated audience is visible to everyone, which is every course
 * that existed before story 12.4 — see lib/course/visibility.ts.
 *
 * `subsectionCount` counts only the lessons this caller can see. Counting all
 * of them would advertise the existence of a restricted lesson on a card and
 * then not show it, which reads as a broken course rather than a hidden one.
 */
export async function GET() {
  return handle(CONTEXT, async () => {
    const gate = await requireApiSession(CONTEXT);
    if (!gate.ok) return gate.response;

    const role = gate.session.currentRole;
    const courses = await getAllCourses();

    return NextResponse.json({
      courses: courses
        .filter((course) => canSeeCourse(role, course.visibleToRoles))
        .map((course) => ({
          id: course.id,
          title: course.title,
          description: course.description,
          subsectionCount: course.sections.reduce(
            (sum, section) =>
              sum +
              section.subsections.filter((subsection) =>
                canSeeSubsection(role, subsection.visibleToRoles),
              ).length,
            0,
          ),
        })),
    });
  });
}
