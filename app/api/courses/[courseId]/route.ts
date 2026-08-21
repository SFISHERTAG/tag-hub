import { NextResponse, type NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/api-session";
import { getCourse } from "@/lib/course/data";
import { getCourseProgress } from "@/lib/course/firestore";
import { handle, notFound } from "../../admin/_lib/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/courses/[courseId]
 * 200: {
 *   course: Course,
 *   progress: Record<"sectionId/subsectionId/checkboxId", { completed: boolean, completedAt?: number }>
 * }
 * 404: course does not exist
 *
 * Any signed-in user. `courseId` accepts a slug or an id.
 *
 * The progress returned is always the *caller's own*, read from `session.uid`.
 * There is deliberately no uid parameter: one would let any signed-in user
 * read another's completion record, and nothing about this screen needs that.
 *
 * `getCourseProgress` returns a Map, which does not survive JSON — it is
 * flattened to a plain object here, keyed exactly the way the checkbox lookup
 * keys it, so the client can index it directly.
 *
 * Note on routing: `/api/courses/progress` is a static sibling of this dynamic
 * segment and Next resolves static first, so a course whose *slug* were
 * literally "progress" would be unreachable here. No such course exists;
 * flagged rather than worked around.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;
  const context = `GET /api/courses/${courseId}`;

  return handle(context, async () => {
    const gate = await requireApiSession(context);
    if (!gate.ok) return gate.response;

    const course = await getCourse(courseId);
    if (!course) throw notFound("Course not found.");

    // A Firestore failure here must not read as "nothing completed" — that is
    // the same class of bug as the rollback that deleted a checkbox entry. It
    // is logged and re-thrown so the caller sees a failure, not a blank
    // progress bar over real completed work.
    const progress = await getCourseProgress(gate.session.uid, course.id);

    return NextResponse.json({
      course,
      progress: Object.fromEntries(progress),
    });
  });
}
