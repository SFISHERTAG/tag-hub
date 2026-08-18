import "server-only";
import { FieldValue } from "@google-cloud/firestore";
import { firestore } from "@/lib/firestore";

/**
 * Task completion is keyed by Fulfillment opportunity, not by client/location
 * alone — a client that churns and re-onboards gets a fresh opportunity and a
 * fresh checklist rather than inheriting stale checkmarks.
 */
const completionDoc = (locationId: string, opportunityId: string) =>
  `locations/${locationId}/onboardingChecklists/${opportunityId}`;

export type OnboardingCompletion = {
  /** Task id -> epoch ms it was marked complete. */
  completedTasks: Record<string, number>;
};

export async function loadCompletedTasks(
  locationId: string,
  opportunityId: string,
): Promise<Set<string>> {
  const snapshot = await firestore().doc(completionDoc(locationId, opportunityId)).get();
  if (!snapshot.exists) return new Set();
  const data = snapshot.data() as OnboardingCompletion;
  return new Set(Object.keys(data.completedTasks ?? {}));
}

export async function setTaskComplete(
  locationId: string,
  opportunityId: string,
  taskId: string,
  complete: boolean,
): Promise<void> {
  const db = firestore();
  const ref = db.doc(completionDoc(locationId, opportunityId));
  if (complete) {
    await ref.set({ completedTasks: { [taskId]: Date.now() } }, { merge: true });
  } else {
    await ref.set({ completedTasks: { [taskId]: FieldValue.delete() } }, { merge: true });
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
  await firestore()
    .doc(completionDoc(locationId, opportunityId))
    .set({ completedTasks }, { merge: true });
}
