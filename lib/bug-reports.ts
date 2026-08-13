import "server-only";
import { firestore } from "@/lib/firestore";
import { FieldValue } from "@google-cloud/firestore";

/**
 * User-facing bug reports — separate from server error logs on purpose.
 *
 * The "Connected to GoHighLevel" indicator this replaces told the user
 * nothing actionable: a green dot next to a page that's already broken is
 * worse than no indicator, since it points attention away from the real
 * problem. A report from the person who hit the issue, with the page they
 * were on and what they were doing, is a better signal than a health check
 * ever was.
 */

export type BugReportStatus = "submitted" | "in_review" | "resolved" | "closed";

export type BugReport = {
  id: string;
  userId: string;
  userEmail: string;
  title: string;
  description: string;
  stepsToReproduce?: string;
  pageArea?: string;
  status: BugReportStatus;
  createdAt: number;
};

export async function submitBugReport(input: {
  userId: string;
  userEmail: string;
  title: string;
  description: string;
  stepsToReproduce?: string;
  pageArea?: string;
}): Promise<void> {
  await firestore().collection("bugReports").add({
    ...input,
    status: "submitted" as BugReportStatus,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function getMyBugReports(userId: string): Promise<BugReport[]> {
  const snapshot = await firestore()
    .collection("bugReports")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId,
      userEmail: data.userEmail,
      title: data.title,
      description: data.description,
      stepsToReproduce: data.stepsToReproduce,
      pageArea: data.pageArea,
      status: data.status ?? "submitted",
      createdAt: data.createdAt?.toMillis?.() ?? 0,
    };
  });
}
