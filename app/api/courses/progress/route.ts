import { NextResponse, type NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/api-session";
import { getUserCheckboxProgress, updateCheckboxProgress } from "@/lib/course/firestore";
import { handle, readJson, requiredBoolean, requiredString } from "../../admin/_lib/http";

export const dynamic = "force-dynamic";

const CONTEXT = "POST /api/courses/progress";

/**
 * POST /api/courses/progress
 * Body: { courseId, sectionId, subsectionId, checkboxId, completed: boolean }
 * 200:  { ok: true, key: "sectionId/subsectionId/checkboxId",
 *         completed: boolean, completedAt: number | null }
 *
 * Any signed-in user, writing only their own progress: the uid comes from the
 * session and there is no uid field in the body.
 *
 * Two things this returns on purpose.
 *
 * The response carries the value that is now *actually stored*, read back
 * after the write rather than echoed from the request. The client's optimistic
 * update reconciles against that instead of assuming its own guess landed.
 *
 * And a failure is a non-2xx with a typed body, never a 200 with an empty
 * result. That matters more here than it looks: the client rolls back a failed
 * toggle, and the rollback must restore the *previous* value rather than drop
 * the entry — a dropped entry reads as unchecked, which erases a completion
 * the user really earned and sends them off to redo the work. The transport
 * has to make failure unambiguous for that rollback to be reachable at all.
 *
 * (The prior version answered an expired session with a 500, because
 * `requireSession()` redirects and the catch-all swallowed the redirect. An
 * XHR then saw a server error and the Angular authInterceptor's
 * refresh-on-401 had nothing to fire on.)
 */
export async function POST(request: NextRequest) {
  return handle(CONTEXT, async () => {
    const gate = await requireApiSession(CONTEXT);
    if (!gate.ok) return gate.response;

    const body = await readJson(request);
    const courseId = requiredString(body, "courseId");
    const sectionId = requiredString(body, "sectionId");
    const subsectionId = requiredString(body, "subsectionId");
    const checkboxId = requiredString(body, "checkboxId");
    const completed = requiredBoolean(body, "completed");

    const { uid } = gate.session;
    await updateCheckboxProgress(uid, courseId, sectionId, subsectionId, checkboxId, completed);

    const stored = await getUserCheckboxProgress(
      uid,
      courseId,
      sectionId,
      subsectionId,
      checkboxId,
    );

    return NextResponse.json({
      ok: true,
      key: `${sectionId}/${subsectionId}/${checkboxId}`,
      completed: stored?.completed ?? completed,
      completedAt: stored?.completedAt ?? null,
    });
  });
}
