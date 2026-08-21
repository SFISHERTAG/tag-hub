/**
 * The wire shape of `/api/bug-reports`, plus the two presentation decisions
 * that belong next to it.
 *
 * There is no `userId` here on either verb, and that is the security design
 * rather than an omission: the endpoint filters the list on `session.uid` and
 * stamps a submission with it, so reading someone else's reports or filing one
 * under their name is not expressible in the request.
 */
export type BugReportStatus = 'submitted' | 'in_review' | 'resolved' | 'closed';

export interface BugReport {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly stepsToReproduce: string | null;
  readonly pageArea: string | null;
  readonly status: BugReportStatus;
  /** Epoch milliseconds. 0 when the server timestamp has not resolved yet. */
  readonly createdAt: number;
}

export interface BugReportList {
  readonly reports: readonly BugReport[];
  /**
   * The "where did this happen" options, in display order.
   *
   * Served rather than hardcoded here on purpose. The Next form owned this list
   * and the action accepted any string at all, so the dropdown and the accepted
   * set could drift apart silently. The endpoint validates against the same
   * array it sends, so they cannot.
   */
  readonly pageAreas: readonly string[];
}

export interface NewBugReport {
  readonly title: string;
  readonly description: string;
  readonly stepsToReproduce?: string;
  readonly pageArea?: string;
}

/** 201 body. Deliberately not the refreshed list: the screen refetches instead. */
export interface BugReportSubmitted {
  readonly ok: true;
}

/**
 * Mirrors the server's bounds so an over-long field is caught before a round
 * trip. The server is still the authority; these only save the user a rejection
 * they can see coming.
 */
export const BUG_REPORT_LIMITS = {
  title: 200,
  description: 5000,
  steps: 5000,
} as const;

const STATUS_LABELS: Record<BugReportStatus, string> = {
  submitted: 'Submitted',
  in_review: 'In review',
  resolved: 'Resolved',
  closed: 'Closed',
};

export function bugReportStatusLabel(status: BugReportStatus): string {
  // Falls back to the raw value so a status added server-side before this
  // client knows about it reads as itself rather than as blank.
  return STATUS_LABELS[status] ?? status;
}

/**
 * `createdAt` is 0 when Firestore's server timestamp had not materialised at
 * read time, which in practice means the report was filed moments ago. Saying
 * so beats printing an epoch date from 1970.
 */
export function bugReportFiledLabel(createdAt: number): string {
  if (createdAt <= 0) return 'Just submitted';

  return new Date(createdAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Sort key for the filed column. An unresolved timestamp is the NEWEST row, not
 * the oldest, so it must not sort to the bottom as a bare 0 would.
 */
export function bugReportFiledSortValue(createdAt: number): number {
  return createdAt <= 0 ? Number.MAX_SAFE_INTEGER : createdAt;
}
