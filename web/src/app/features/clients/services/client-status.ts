import type { ClientStatus, EscalationBucket } from './client.model';

/**
 * Port of `lib/dashboard/health-scoring.ts#getStatusDisplay`, with the colours
 * taken out.
 *
 * The original returned Tailwind class names (`text-ok`, `text-danger`) from a
 * data function, which is how a colour decision ends up somewhere no theme can
 * reach. Here the function returns a *tone*, and the stylesheet maps tone to an
 * M3 system token. Nothing in this feature names a colour.
 *
 * The five-dot `icon` string is dropped too. It was decorative, it read as
 * "●●●○○" to a screen reader, and the score is already shown next to it.
 */
export type StatusTone = 'positive' | 'caution' | 'negative';

export interface StatusDisplay {
  readonly label: string;
  readonly tone: StatusTone;
  /** Filled dots out of five. Rendered as a graphic with a text alternative. */
  readonly rank: number;
}

const STATUS_DISPLAY: Record<ClientStatus, StatusDisplay> = {
  excellent: { label: 'Excellent', tone: 'positive', rank: 5 },
  healthy: { label: 'Healthy', tone: 'positive', rank: 4 },
  'at-risk': { label: 'At risk', tone: 'caution', rank: 3 },
  critical: { label: 'Critical', tone: 'negative', rank: 2 },
  alert: { label: 'Alert', tone: 'negative', rank: 1 },
};

export function statusDisplay(status: ClientStatus): StatusDisplay {
  return STATUS_DISPLAY[status];
}

export function statusLabel(status: ClientStatus): string {
  return STATUS_DISPLAY[status].label;
}

/**
 * The three statuses that mean "look at this one".
 *
 * Shared by the health widget's filter and the book's counts so the two cannot
 * disagree about what needs attention.
 */
const NEEDS_ATTENTION: readonly ClientStatus[] = ['at-risk', 'critical', 'alert'];

export function needsAttention(status: ClientStatus): boolean {
  return NEEDS_ATTENTION.includes(status);
}

/** Order the kanban columns appear in: worst first, because that is the job. */
export const STATUS_ORDER: readonly ClientStatus[] = [
  'alert',
  'critical',
  'at-risk',
  'healthy',
  'excellent',
];

/**
 * Sort rank for the escalation view's "by stage" ordering.
 *
 * Named for what it actually is. The reference implementation called this
 * `STATUS_RANK` under a `sortKey` called "stage" with a comment admitting that
 * pipeline stage is not wired into ClientData yet, so health status was
 * standing in for it. It still is. Calling the control "Health" rather than
 * "Stage" is the smaller lie.
 */
const ESCALATION_SORT_RANK: Record<ClientStatus, number> = {
  critical: 0,
  alert: 1,
  'at-risk': 2,
  healthy: 3,
  excellent: 4,
};

export function escalationSortRank(status: ClientStatus): number {
  return ESCALATION_SORT_RANK[status];
}

export interface BucketDisplay {
  readonly title: string;
  readonly tone: StatusTone;
}

const BUCKET_DISPLAY: Record<EscalationBucket, BucketDisplay> = {
  'at-risk': { title: 'At risk', tone: 'negative' },
  'ascension-ready': { title: 'Ascension ready', tone: 'positive' },
  'no-action-needed': { title: 'No action needed', tone: 'caution' },
};

export function bucketDisplay(bucket: EscalationBucket): BucketDisplay {
  return BUCKET_DISPLAY[bucket];
}

/** Left to right, worst first — same reasoning as STATUS_ORDER. */
export const BUCKET_ORDER: readonly EscalationBucket[] = [
  'at-risk',
  'ascension-ready',
  'no-action-needed',
];

/**
 * Tone for an average health score, matching the status thresholds in
 * `health-scoring.ts#getStatusFromScore` rather than inventing new ones. A
 * rollup that called 74 "healthy" while the client rows called it "at risk"
 * would be two different opinions on one screen.
 */
export function scoreTone(score: number): StatusTone {
  if (score >= 75) return 'positive';
  if (score >= 60) return 'caution';
  return 'negative';
}

export function checkInLabel(daysSinceLastCheckIn: number | null): string {
  if (daysSinceLastCheckIn === null) return 'No check-in yet (fresh onboarding)';
  if (daysSinceLastCheckIn === 0) return 'Checked in today';
  if (daysSinceLastCheckIn === 1) return 'Last check-in 1 day ago';
  return `Last check-in ${daysSinceLastCheckIn} days ago`;
}
