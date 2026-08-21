/**
 * The wire shapes of `app/api/ghl/**`, mirrored for the browser.
 *
 * These are a MIRROR, not a second definition. Every type below is the exact
 * body one endpoint returns; the endpoint derives it from `lib/ghl/*`, which
 * this side cannot import (lib/ is `server-only`, and reaching into it would
 * pull Firestore and gRPC toward the browser bundle). When an endpoint's shape
 * changes, this file changes with it in the same commit — that is the whole
 * contract, and a compile error here is the intended way to find out.
 *
 * Money is a raw number on the wire and is formatted here (services/ghl-format
 * .ts). Timestamps are ISO strings except `markedAt`, which is epoch ms because
 * it comes from Firestore rather than GHL.
 */

/* ------------------------------------------------------------------ pipeline */

export type OpportunityStatus = 'open' | 'won' | 'lost' | 'abandoned';

/** The board's filter. `all` is not an opportunity status, only a query. */
export type PipelineStatusFilter = OpportunityStatus | 'all';

export const PIPELINE_STATUS_FILTERS: readonly PipelineStatusFilter[] = [
  'open',
  'won',
  'lost',
  'abandoned',
  'all',
];

export function isPipelineStatusFilter(value: string | null): value is PipelineStatusFilter {
  return value !== null && (PIPELINE_STATUS_FILTERS as readonly string[]).includes(value);
}

export interface PipelineStage {
  readonly id: string;
  readonly name: string;
  readonly position: number;
}

export interface OpportunityContact {
  readonly id: string;
  readonly name?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly companyName?: string;
}

export interface Opportunity {
  readonly id: string;
  readonly name: string;
  readonly pipelineId: string;
  readonly pipelineStageId: string;
  readonly status: OpportunityStatus;
  readonly monetaryValue: number;
  readonly source?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastStageChangeAt?: string;
  readonly assignedTo?: string | null;
  readonly contact?: OpportunityContact;
}

/** An opportunity plus the staleness the server computed. `daysInStage` is null
 * when GHL sent no usable timestamp — which is not the same as zero days. */
export interface PipelineCard extends Opportunity {
  readonly daysInStage: number | null;
  readonly stale: boolean;
}

export interface PipelineColumn {
  readonly stage: PipelineStage;
  readonly cards: readonly PipelineCard[];
  readonly count: number;
  readonly value: number;
}

export interface PipelineBoard {
  readonly pipeline: { readonly id: string; readonly name: string };
  readonly columns: readonly PipelineColumn[];
  /** Cards whose stage id is not one of this pipeline's stages. The legacy
   * board dropped these silently; a deal that vanishes is worse than one in an
   * "unknown" column, so the screen renders them. */
  readonly unstaged: readonly PipelineCard[];
  readonly count: number;
  readonly value: number;
}

export interface PipelineResponse {
  readonly status: PipelineStatusFilter;
  readonly staleAfterDays: number;
  readonly boards: readonly PipelineBoard[];
}

export interface MoveStageRequest {
  readonly pipelineStageId: string;
  readonly previousStageName?: string;
}

export interface MoveStageResponse {
  readonly opportunityId: string;
  readonly pipelineStageId: string;
  readonly lastStageChangeAt: string;
  readonly completedTaskIds: readonly string[];
}

export type CloseStatus = 'won' | 'lost';

export interface CloseOpportunityRequest {
  readonly status: CloseStatus;
  readonly monetaryValue: number;
  readonly contactId?: string;
}

export interface CloseOpportunityResponse {
  readonly opportunityId: string;
  readonly status: string;
  readonly monetaryValue: number;
}

/* --------------------------------------------------------------------- today */

export type AppointmentStatus =
  | 'new'
  | 'confirmed'
  | 'showed'
  | 'noshow'
  | 'cancelled'
  | 'invalid';

export interface Calendar {
  readonly id: string;
  readonly name: string;
  readonly calendarType?: string;
}

export interface Appointment {
  readonly id: string;
  readonly calendarId: string;
  readonly contactId?: string;
  readonly assignedUserId?: string;
  readonly title?: string;
  readonly notes?: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly status: AppointmentStatus;
}

/** Already joined to its calendar's name by the endpoint. */
export interface TodayAppointment extends Appointment {
  readonly calendarName: string;
}

export type DayKey = 'yesterday' | 'today' | 'tomorrow';

export const DAY_KEYS: readonly DayKey[] = ['yesterday', 'today', 'tomorrow'];

export function isDayKey(value: string | null): value is DayKey {
  return value !== null && (DAY_KEYS as readonly string[]).includes(value);
}

export interface TodaySummary {
  readonly total: number;
  readonly marked: number;
  /**
   * Whole percent, or null when the outcome store could not be read.
   *
   * Null is NOT zero, and the screen must never render it as one: "we could not
   * load the outcomes" and "nobody showed up" are opposite facts about a
   * closer's day. The value is computed by `getClientHealth` server-side and is
   * structurally bounded at 100% there; nothing on this side re-derives it,
   * which is how that bound stays true.
   */
  readonly showRatePct: number | null;
  readonly dqBreakdown: { readonly preCall: number; readonly onCall: number } | null;
  readonly outcomesUnavailable: boolean;
}

export interface TodayResponse {
  readonly day: DayKey;
  readonly label: string;
  readonly range: { readonly startMs: number; readonly endMs: number };
  readonly calendars: readonly Calendar[];
  readonly appointments: readonly TodayAppointment[];
  readonly summary: TodaySummary;
}

export type OutcomeTiming = 'pre-call' | 'on-call' | 'post-call';

export interface MarkAppointmentRequest {
  readonly status: AppointmentStatus;
  readonly startTime: string;
  readonly endTime: string;
  readonly contactId?: string;
  readonly title?: string;
}

export interface MarkAppointmentResponse {
  readonly appointmentId: string;
  readonly status: AppointmentStatus;
  readonly timing: OutcomeTiming | null;
  /** False means GHL has the status but the timing record was lost, so this
   * appointment's contribution to show rate is degraded. Reported, not hidden. */
  readonly timingRecorded: boolean;
}

/* ------------------------------------------------------------------ contacts */

export interface Attribution {
  readonly utmSource?: string;
  readonly utmMedium?: string;
  readonly utmCampaign?: string;
  readonly utmContent?: string;
  readonly utmAdId?: string;
  readonly utmFbclid?: string;
  readonly fbc?: string;
  readonly fbp?: string;
  readonly referrer?: string;
  readonly pageUrl?: string;
  readonly medium?: string;
  readonly sessionSource?: string;
  readonly campaign?: string;
  readonly url?: string;
}

export interface Contact {
  readonly id: string;
  readonly contactName?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly companyName?: string;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly dateAdded?: string;
  readonly dateUpdated?: string;
  /**
   * Attribution arrives under two different shapes depending on which GHL
   * endpoint produced the contact: the list returns an `attributions` array,
   * the single-contact route returns `attributionSource` and
   * `lastAttributionSource`. The contact DETAIL endpoint normalizes both into
   * `firstTouch`/`lastTouch` for us; `/prep` does not, so the raw fields are
   * carried here and `firstTouchOf`/`lastTouchOf` in ghl-format.ts read them.
   */
  readonly attributions?: readonly Attribution[];
  readonly attributionSource?: Attribution;
  readonly lastAttributionSource?: Attribution;
}

/** A contact whose display name the server already resolved. The fallback chain
 * lives in lib/ghl/format.ts and is deliberately not reimplemented here. */
export interface ContactSummary extends Contact {
  readonly displayName: string;
}

export interface Note {
  readonly id: string;
  readonly body: string;
  readonly userId?: string;
  readonly dateAdded?: string;
}

export interface ContactsResponse {
  readonly query: string | null;
  readonly limit: number;
  readonly contacts: readonly ContactSummary[];
  /** The page was full, so there are probably more. GHL returns no total. */
  readonly truncated: boolean;
}

export interface ContactDetailResponse {
  readonly contact: ContactSummary;
  readonly notes: readonly Note[];
  readonly firstTouch: Attribution | null;
  readonly lastTouch: Attribution | null;
  readonly metaTrackable: { readonly firstTouch: boolean; readonly lastTouch: boolean };
}

export interface NotesResponse {
  readonly notes: readonly Note[];
}

export interface PrepResponse {
  readonly contact: ContactSummary;
  readonly notes: readonly Note[];
  readonly opportunity: Opportunity | null;
}

/* ----------------------------------------------------------------- follow-up */

export type FollowUpThresholdMode = 'days' | 'attempts';

export const FOLLOW_UP_MODES: readonly FollowUpThresholdMode[] = ['days', 'attempts'];

export function isFollowUpMode(value: unknown): value is FollowUpThresholdMode {
  return typeof value === 'string' && (FOLLOW_UP_MODES as readonly string[]).includes(value);
}

export interface FollowUpConfig {
  readonly mode: FollowUpThresholdMode;
  readonly value: number;
}

export interface FollowUpCandidate {
  readonly appointmentId: string;
  readonly contactId: string;
  readonly contactName: string;
  readonly appointmentTitle: string;
  /** Epoch ms. */
  readonly markedAt: number;
  readonly status: 'noshow' | 'invalid';
  readonly timing: OutcomeTiming;
  readonly attempts: number;
}

export interface FollowUpEntry extends FollowUpCandidate {
  /** Null when the missed appointment fell outside the lookback window. It does
   * NOT clear the candidate: the outcome record carries the denormalized name
   * and title precisely so a row can still render. */
  readonly appointment: Appointment | null;
  readonly contact: ContactSummary | null;
  readonly opportunity: Opportunity | null;
}

export interface FollowUpResponse {
  readonly config: FollowUpConfig;
  /** Cosmetic hint. The config PUT re-checks the role server-side. */
  readonly canConfigure: boolean;
  readonly lookaheadDays: number;
  readonly lookbackDays: number;
  readonly total: number;
  readonly truncated: boolean;
  readonly enriched: boolean;
  /** The saved threshold could not be read and the default was used. That
   * changes which candidates survive, so it is shown rather than swallowed. */
  readonly configFallback: boolean;
  readonly candidates: readonly FollowUpEntry[];
}

export interface FollowUpConfigResponse {
  readonly config: FollowUpConfig;
  readonly canConfigure: boolean;
}
