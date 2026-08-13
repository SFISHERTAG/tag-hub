import { db } from "@/lib/firestore";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

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
  const docRef = doc(
    db,
    "userProgress",
    uid,
    "courses",
    courseId,
    "sections",
    sectionId,
    "subsections",
    subsectionId,
    "checkboxes",
    checkboxId,
  );

  const snapshot = await getDoc(docRef);
  return snapshot.exists() ? (snapshot.data() as ProgressDoc) : null;
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
  const docRef = doc(
    db,
    "userProgress",
    uid,
    "courses",
    courseId,
    "sections",
    sectionId,
    "subsections",
    subsectionId,
    "checkboxes",
    checkboxId,
  );

  await setDoc(
    docRef,
    {
      completed,
      completedAt: completed ? serverTimestamp() : null,
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
  const collectionRef = collection(db, coursePath, "sections");

  const progress = new Map<string, ProgressDoc>();

  // Firebase doesn't support recursive collection queries in the client SDK,
  // so we need to fetch sections, then subsections, then checkboxes
  const sectionsSnap = await getDocs(collectionRef);

  for (const sectionSnap of sectionsSnap.docs) {
    const subsectionsRef = collection(db, coursePath, "sections", sectionSnap.id, "subsections");
    const subsectionsSnap = await getDocs(subsectionsRef);

    for (const subsectionSnap of subsectionsSnap.docs) {
      const checkboxesRef = collection(
        db,
        coursePath,
        "sections",
        sectionSnap.id,
        "subsections",
        subsectionSnap.id,
        "checkboxes",
      );
      const checkboxesSnap = await getDocs(checkboxesRef);

      for (const checkboxSnap of checkboxesSnap.docs) {
        const key = `${sectionSnap.id}/${subsectionSnap.id}/${checkboxSnap.id}`;
        progress.set(key, checkboxSnap.data() as ProgressDoc);
      }
    }
  }

  return progress;
}
