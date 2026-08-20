"use server";

import { revalidatePath } from "next/cache";
import { getSession, ownsLocation } from "@/lib/auth/session";
import { isClientUser } from "@/lib/dashboard/location-selection";
import { setTaskComplete } from "@/lib/onboarding/store";
import { logAction } from "@/lib/audit/store";

/** CSM-only (AC5: read-only for client users). */
export async function markTaskComplete(
  locationId: string,
  opportunityId: string,
  taskId: string,
  complete: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Not signed in." };
  }
  if (isClientUser(session.currentRole)) {
    return { ok: false, error: "Only TAG staff can update the checklist." };
  }
  // "Not a client user" is not the same as "this client is yours". Without
  // this any CSM could tick another client's onboarding tasks — including
  // "Fund the account" — and it would land in the audit log as legitimate.
  if (!(await ownsLocation(session, locationId))) {
    return { ok: false, error: "That client account is not available to this login." };
  }

  try {
    await setTaskComplete(locationId, opportunityId, taskId, complete);
    await logAction(locationId, {
      actorId: session.uid,
      actorRole: session.currentRole,
      action: complete ? "onboarding.task_complete" : "onboarding.task_reopen",
      targetType: "opportunity",
      targetId: opportunityId,
      metadata: { taskId },
    });
    revalidatePath("/onboarding");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
