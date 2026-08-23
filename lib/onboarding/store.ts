import "server-only";
import { deleteField, repository } from "@/lib/data";

/**
 * Task completion is keyed by Fulfillment opportunity, not by client/location
 * alone — a client that churns and re-onboards gets a fresh opportunity and a
 * fresh checklist rather than inheriting stale checkmarks.
 */
const completionDoc = (locationId: string, opportunityId: string) =>
  repository().onboardingChecklists(locationId).doc(opportunityId);

export type OnboardingCompletion = {
  /** Task id -> epoch ms it was marked complete. */
  completedTasks: Record<string, number>;
};

export async function loadCompletedTasks(
  locationId: string,
  opportunityId: string,
): Promise<Set<string>> {
  const data = await completionDoc(locationId, opportunityId).get();
  if (!data) return new Set();
  return new Set(Object.keys(data.completedTasks ?? {}));
}

export async function setTaskComplete(
  locationId: string,
  opportunityId: string,
  taskId: string,
  complete: boolean,
): Promise<void> {
  const ref = completionDoc(locationId, opportunityId);
  if (complete) {
    await ref.set({ completedTasks: { [taskId]: Date.now() } }, { merge: true });
  } else {
    // Removes the key rather than writing a falsy value: loadCompletedTasks
    // reads Object.keys, so a task marked incomplete has to be absent, not
    // present-and-zero.
    await ref.set({ completedTasks: { [taskId]: deleteField() } }, { merge: true });
  }
}

/** Marks every task for a stage complete in one write, used on stage advance. */
export async function completeStageTasks(
  locationId: string,
  opportunityId: string,
  taskIds: string[],
): Promise<void> {
  if (taskIds.length === 0) return;
  const now = Date.now();
  const completedTasks: Record<string, number> = {};
  for (const taskId of taskIds) completedTasks[taskId] = now;
  await completionDoc(locationId, opportunityId).set({ completedTasks }, { merge: true });
}
