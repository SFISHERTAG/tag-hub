import { NextResponse, type NextRequest } from "next/server";
import { requireApiLocationAccess } from "@/lib/auth/api-session";
import { logAction } from "@/lib/audit/store";
import { STAGE_TASKS } from "@/lib/onboarding/stage-tasks";
import { loadCompletedTasks, setTaskComplete } from "@/lib/onboarding/store";
import {
  badRequest,
  handle,
  readJson,
  requiredBoolean,
  requiredString,
  requireApiRole,
} from "../../../admin/_lib/http";
import { ONBOARDING_ROLES } from "../../_launch";

export const dynamic = "force-dynamic";

/** Every task id the fixed stage mapping defines, flattened once at module load. */
const KNOWN_TASK_IDS = new Set(
  Object.values(STAGE_TASKS).flatMap((tasks) => tasks.map((task) => task.id)),
);

/**
 * POST /api/onboarding/checklist/task
 * Body: { locationId: string, opportunityId: string, taskId: string, complete: boolean }
 * 200:  { ok: true, completedTaskIds: string[] }
 *
 * TAG exec / CSM only. `locationId` is caller-supplied and re-checked against
 * the session before any write.
 *
 * `taskId` is validated against the fixed stage mapping rather than written
 * straight through. Without that, the id is an arbitrary caller-chosen key in
 * a Firestore map, and the checklist document accumulates junk keys nothing
 * ever renders or cleans up.
 *
 * The response returns the completed set read back from the store, not an
 * echo of the request, so the client's optimistic toggle reconciles against
 * what is actually persisted. A failure is a non-2xx, which is what lets the
 * client restore the previous value rather than drop the task.
 */
export async function POST(request: NextRequest) {
  const context = "POST /api/onboarding/checklist/task";

  return handle(context, async () => {
    const gate = await requireApiRole(ONBOARDING_ROLES, context);
    if (!gate.ok) return gate.response;

    const body = await readJson(request);
    const locationId = requiredString(body, "locationId");
    const opportunityId = requiredString(body, "opportunityId");
    const taskId = requiredString(body, "taskId");
    const complete = requiredBoolean(body, "complete");

    if (!KNOWN_TASK_IDS.has(taskId)) {
      throw badRequest(`Unknown checklist task "${taskId}".`);
    }

    const access = await requireApiLocationAccess(locationId, context);
    if (!access.ok) return access.response;

    await setTaskComplete(locationId, opportunityId, taskId, complete);
    await logAction(locationId, {
      actorId: access.session.uid,
      actorRole: access.session.currentRole,
      action: complete ? "onboarding.task_complete" : "onboarding.task_reopen",
      targetType: "opportunity",
      targetId: opportunityId,
      metadata: { taskId },
    });

    const completed = await loadCompletedTasks(locationId, opportunityId);
    return NextResponse.json({ ok: true, completedTaskIds: [...completed] });
  });
}
