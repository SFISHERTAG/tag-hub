import "server-only";
import { Timestamp } from "@google-cloud/firestore";
import { firestore } from "@/lib/firestore";

export type ProgressDoc = {
  completed: boolean;
  completedAt?: number;
};

/**
 * Get a user's progress for a specific checkbox across all courses.
 */
export async function getUserCheckboxProgress(
  uid: string,
  courseId: string,
  sectionId: string,
  subsectionId: string,
  checkboxId: string,
): Promise<ProgressDoc | null> {
  const docRef = firestore().doc(
    `userProgress/${uid}/courses/${courseId}/sections/${sectionId}/subsections/${subsectionId}/checkboxes/${checkboxId}`,
  );

  const snapshot = await docRef.get();
  if (!snapshot.exists) return null;

  const data = snapshot.data()!;
  return {
    completed: Boolean(data.completed),
    completedAt: data.completedAt instanceof Timestamp ? data.completedAt.toMillis() : undefined,
  };
}

/**
 * Update a user's progress for a checkbox.
 */
export async function updateCheckboxProgress(
  uid: string,
  courseId: string,
  sectionId: string,
  subsectionId: string,
  checkboxId: string,
  completed: boolean,
): Promise<void> {
  const docRef = firestore().doc(
    `userProgress/${uid}/courses/${courseId}/sections/${sectionId}/subsections/${subsectionId}/checkboxes/${checkboxId}`,
  );

  await docRef.set(
    {
      completed,
      completedAt: completed ? Timestamp.now() : null,
    },
    { merge: true },
  );
}

/**
 * Get all progress for a user in a specific course.
 */
export async function getCourseProgress(
  uid: string,
  courseId: string,
): Promise<Map<string, ProgressDoc>> {
  const coursePath = `userProgress/${uid}/courses/${courseId}`;
  const progress = new Map<string, ProgressDoc>();

  // Firestore has no recursive collection-group query scoped to this one
  // course/user path, so sections -> subsections -> checkboxes are walked
  // level by level, same shape the original client-SDK version used.
  const sectionsSnap = await firestore().collection(`${coursePath}/sections`).get();

  for (const sectionSnap of sectionsSnap.docs) {
    const subsectionsSnap = await firestore()
      .collection(`${coursePath}/sections/${sectionSnap.id}/subsections`)
      .get();

    for (const subsectionSnap of subsectionsSnap.docs) {
      const checkboxesSnap = await firestore()
        .collection(
          `${coursePath}/sections/${sectionSnap.id}/subsections/${subsectionSnap.id}/checkboxes`,
        )
        .get();

      for (const checkboxSnap of checkboxesSnap.docs) {
        const data = checkboxSnap.data();
        const key = `${sectionSnap.id}/${subsectionSnap.id}/${checkboxSnap.id}`;
        progress.set(key, {
          completed: Boolean(data.completed),
          completedAt: data.completedAt instanceof Timestamp ? data.completedAt.toMillis() : undefined,
        });
      }
    }
  }

  return progress;
}
