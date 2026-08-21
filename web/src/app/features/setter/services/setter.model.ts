/**
 * Wire shapes for `GET /api/setter/dashboard`, mirrored from
 * lib/dashboard/speed-to-lead.ts.
 *
 * The dates differ from the server type on purpose: `LeadMetric.createdAt` and
 * `firstContactAt` are `Date` in lib/ and ISO strings once they have crossed
 * JSON. Typing them as `Date` here would compile and then fail at the first
 * `.getTime()`, which is the classic way a wire type lies.
 */
export type LeadPriority = 'urgent' | 'normal' | 'aged';
export type LeadStatus = 'uncontacted' | 'contacted' | 'qualified' | 'lost';

export interface LeadMetric {
  readonly id: string;
  readonly name: string;
  readonly email?: string;
  readonly phone?: string;
  /** ISO 8601. */
  readonly createdAt: string;
  /** ISO 8601. */
  readonly firstContactAt?: string;
  readonly speedToLeadMinutes?: number;
  readonly status: LeadStatus;
  readonly assignedTo?: string;
  readonly ageMinutes: number;
  readonly priority: LeadPriority;
}

export interface SetterMetrics {
  readonly totalLeadsToday: number;
  readonly contactedToday: number;
  readonly contactRate: number;
  readonly averageSpeedMinutes: number;
  readonly pendingCallbacks: number;
  readonly qualifiedLeads: number;
  readonly medianSpeedMinutes: number;
}

export interface SetterDashboardData {
  readonly locationId: string;
  /** From the session server-side. There is no parameter for it. */
  readonly setterEmail: string;
  /** ISO 8601 — when the server built this response. What staleness counts from. */
  readonly refreshedAt: string;
  readonly metrics: SetterMetrics;
  readonly leads: readonly LeadMetric[];
}

export const LEAD_PRIORITIES: readonly LeadPriority[] = ['urgent', 'normal', 'aged'];

export const PRIORITY_LABELS: Record<LeadPriority, string> = {
  urgent: 'Urgent',
  normal: 'Normal',
  aged: 'Aged',
};

/** "-" for absent, so a missing reading never renders as a plausible 0m. */
export function formatMinutes(minutes: number | undefined): string {
  if (minutes === undefined || minutes <= 0) return '-';
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
