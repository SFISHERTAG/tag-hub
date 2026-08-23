import "server-only";
import { repository, serverTimestamp } from "@/lib/data";

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
  await repository().bugReports.add({
    ...input,
    status: "submitted" as BugReportStatus,
    // Assigned by the store, not this process: a report's time is when it
    // landed, not when a caller's clock said so.
    createdAt: serverTimestamp(),
  });
}

export async function getMyBugReports(userId: string): Promise<BugReport[]> {
  const found = await repository().bugReports.list({
    where: [{ field: "userId", op: "==", value: userId }],
    orderBy: { field: "createdAt", direction: "desc" },
    limit: 20,
  });

  return found.map(({ id, data }) => ({
    id,
    userId: data.userId,
    userEmail: data.userEmail,
    title: data.title,
    description: data.description,
    stepsToReproduce: data.stepsToReproduce,
    pageArea: data.pageArea,
    status: data.status ?? "submitted",
    // The repository normalises Timestamp to epoch millis, so the
    // `?.toMillis?.() ?? 0` dance that used to live here is gone.
    createdAt: data.createdAt ?? 0,
  }));
}
