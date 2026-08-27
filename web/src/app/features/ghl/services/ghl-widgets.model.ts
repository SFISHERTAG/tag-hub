/**
 * The wire shapes of the GHL-backed dashboard widget endpoints under
 * `/api/dashboard/widgets/**`, mirrored from the route files so a change on
 * either side is a compile error rather than an `undefined` at runtime.
 *
 * Same convention, and same reason, as
 * `features/clients/services/client.model.ts`: `web/` builds against its own
 * tsconfig and cannot import `lib/`, so the shapes are restated here rather
 * than shared. Mirroring is the cost of the workspace split, which is why each
 * type below names the route file it mirrors.
 *
 * None of these take a location id. `resolveDashboardLocation(session)` derives
 * it server-side from the session, so there is no identifier here a caller
 * could substitute to widen what it sees, and no location to thread through the
 * component. That is the difference between these and the `/api/ghl/locations/
 * :locationId/**` endpoints in `ghl.model.ts`.
 */

import type { SampleDataDisclosure } from '../../../shared/ui';

// Re-exported. Declared once in
// shared/ui/sample-data-notice/sample-data-notice.model.ts. Cite that file, not
// this one: a re-export declares nothing, and a doc that names the alias sends
// the next reader grepping for a definition that is not there.
export type { SampleDataDisclosure };

/**
 * A non-fatal caveat attached to widget data — mirrors
 * `app/api/dashboard/_lib/widget-payload.ts`.
 *
 * Distinct from an error: the data IS present, it just cannot be read at face
 * value. `truncated` is why this exists — a capped contact fetch produces a
 * confident-looking undercount that is indistinguishable from a real reading,
 * so the caveat has to reach the screen rather than being dropped by a caller
 * that only looked at the numbers.
 */
export interface WidgetWarning {
  readonly code: 'truncated' | 'no_location' | 'sample_data';
  readonly message: string;
}

/** Mirrors `FunnelStageCount` / `FunnelStage`, which are the same shape. */
export interface FunnelStage {
  readonly stage: 'Leads' | 'Booked' | 'Showed' | 'Closed';
  readonly count: number;
}

/**
 * Mirrors `FunnelCountsResult` in `lib/dashboard/funnel.ts`.
 *
 * The `ok: false` arm is the important half. It arrives inside an HTTP **200**,
 * so nothing in the transport layer treats it as a failure: `ApiResult.error`
 * is null and a caller that reads `stages` off it gets `undefined`, or worse,
 * renders a zeroed funnel. That is the "revoked token renders as $0 spend"
 * shape CLAUDE.md's error-handling contract exists to prevent, and the reason
 * this is a discriminated union rather than an optional `stages` field: the
 * compiler will not let a consumer reach `stages` without first proving `ok`.
 */
export type FunnelCountsResult =
  | {
      readonly ok: true;
      readonly stages: readonly FunnelStage[];
      /**
       * Booked minus pre-call DQ. The correct denominator for the Showed
       * stage's conversion rate, and NOT the same as `stages[1].count`, which
       * still includes pre-call DQs so the funnel shows true booking volume.
       * Any show-rate arithmetic uses this or it is wrong.
       */
      readonly showRateDenominator: number;
      readonly dqBreakdown: { readonly preCall: number; readonly onCall: number };
      /** True when the contact fetch hit its page cap, so every stage is an undercount. */
      readonly truncated: boolean;
    }
  | { readonly ok: false; readonly message: string };

/** Mirrors `LeadsFunnelResponse` in `app/api/dashboard/widgets/leads-funnel/route.ts`. */
export type LeadsFunnelResponse =
  | {
      readonly source: 'live';
      readonly days: number;
      readonly funnel: FunnelCountsResult;
      readonly warnings: readonly WidgetWarning[];
    }
  | {
      readonly source: 'sample';
      readonly days: number;
      readonly stages: readonly FunnelStage[];
      readonly sampleData: SampleDataDisclosure;
      readonly warnings: readonly WidgetWarning[];
    };

/**
 * One appointment, mirrored from `CallForDisplay` in
 * `lib/dashboard/data-fetchers.ts`.
 *
 * `startTimeFormatted` / `endTimeFormatted` are formatted **server-side**, and
 * they are the only times that may be rendered. The raw `startTime` /
 * `endTime` ISO strings are carried for ordering and keys, never for display:
 * formatting them in the browser produces the viewer's midnight rather than the
 * client's. `TodayService` documents the same constraint on the full-page view.
 *
 * **Be precise about which zone the server used, because it is not the
 * tenant's.** `lib/time/zone.ts` exports a single constant,
 * `DEFAULT_TIME_ZONE = "America/Chicago"`, and its header states that no
 * timezone exists anywhere in the system today: not on `Tenant`, not on
 * `LocationConfig`, not in the live `clients` documents. Every formatter takes
 * a zone parameter that defaults to that constant, and no call site passes one,
 * because there is no per-location value to pass. `data-fetchers.ts` calls
 * `formatTime(apt.startTime)` with no zone.
 *
 * That is deliberate and documented, not an oversight, and it is correct while
 * every location is Central. It stops being correct per sublocation, which is
 * the direction this is going. **The contract this type encodes survives that
 * change either way:** the client renders the server's string and never
 * computes one, so giving locations their own zone is a server change and
 * touches no component.
 */
export interface CallForDisplay {
  readonly id: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly startTimeFormatted: string;
  readonly endTimeFormatted: string;
  readonly booked: boolean;
  readonly attendee?: string;
  readonly topic?: string;
  readonly callType: 'discovery' | 'strategy' | 'optimization' | 'follow-up' | 'other';
  readonly status: 'new' | 'confirmed' | 'showed' | 'noshow' | 'cancelled' | 'invalid';
  readonly contactId?: string;
  readonly assignedUserId?: string;
}

/**
 * Mirrors `DayViewResult` in `lib/dashboard/day-view.ts`.
 *
 * Same `ok: false`-inside-a-200 hazard as `FunnelCountsResult`, and the route
 * makes it routine rather than exceptional: the no-location case returns
 * `{ ok: false }` *plus* `NO_LOCATION_WARNING`, so a caller that only reads the
 * transport shows an empty schedule to every account that has not finished
 * setup. The route's own comment draws the line this union enforces: "an empty
 * schedule and an unreachable calendar are different states".
 */
export type DayViewResult =
  | { readonly ok: true; readonly calls: readonly CallForDisplay[] }
  | { readonly ok: false; readonly message: string };

/** Mirrors `DayViewResponse` in `app/api/dashboard/widgets/day-view/route.ts`. */
export interface DayViewResponse {
  readonly dayView: DayViewResult;
  readonly warnings: readonly WidgetWarning[];
}

/** Mirrors `PipelineStageRollup` in `lib/dashboard/pipeline-board.ts`. */
export interface PipelineStageRollup {
  readonly id: string;
  readonly name: string;
  readonly count: number;
  readonly value: number;
}

/** Mirrors `TopDeal` in `app/api/dashboard/widgets/pipeline-board/route.ts`. */
export interface TopDeal {
  readonly name: string;
  readonly value: number;
  readonly stage: string;
}

/** Mirrors `PipelineBoardResult` in `lib/dashboard/pipeline-board.ts`. */
export type PipelineBoardResult =
  | {
      readonly ok: true;
      readonly pipelineName: string;
      readonly stages: readonly PipelineStageRollup[];
    }
  | { readonly ok: false; readonly message: string };

/**
 * Mirrors `PipelineBoardResponse` in the route.
 *
 * **The two arms are not the same information.** `live` carries a stage rollup
 * (count and value per stage of the first open pipeline); `sample` carries a
 * list of top deals. This is not a placeholder standing in for the live shape,
 * it is a different view, inherited from the reference implementation where the
 * fallback was a separate widget body. So the tile genuinely shows something
 * else when no location is configured, and the component renders two layouts
 * rather than one layout over two data sources.
 */
export type PipelineBoardResponse =
  | {
      readonly source: 'live';
      readonly pipeline: PipelineBoardResult;
      readonly warnings: readonly WidgetWarning[];
    }
  | {
      readonly source: 'sample';
      readonly topDeals: readonly TopDeal[];
      readonly sampleData: SampleDataDisclosure;
      readonly warnings: readonly WidgetWarning[];
    };

/**
 * Mirrors `OwnerAppointment` in `lib/dashboard/owner-calendar.ts`.
 *
 * **Note what is missing: there is no `startTimeFormatted`.** Unlike
 * `CallForDisplay`, this type carries only the raw ISO instant, and the payload
 * does not carry the tenant's timezone either, so a clock time cannot be
 * rendered correctly from it on the client. `DayViewWidget`'s constraint
 * applies here with no server-side escape hatch, which is why
 * `OwnerCalendarWidget` shows no times. The day-level fields on `CalendarDay`
 * are server-computed and are safe.
 */
export interface OwnerAppointment {
  readonly id: string;
  readonly title: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly status: 'new' | 'confirmed' | 'showed' | 'noshow' | 'cancelled' | 'invalid';
  readonly isPastOrToday: boolean;
}

/** Mirrors `CalendarDay`. Every field here is computed in the tenant's zone. */
export interface CalendarDay {
  /** ISO date, e.g. "2026-08-18". */
  readonly date: string;
  readonly dayOfMonth: number;
  readonly isToday: boolean;
  readonly isCurrentMonth: boolean;
  readonly appointments: readonly OwnerAppointment[];
}

/**
 * Mirrors `OwnerCalendarResult`.
 *
 * `scoped: false` means the tenant has no `ownerGhlUserId`, so the result is
 * the **whole location's** calendar rather than one person's. The widget is
 * titled "My Calendar". The route's own comment says to surface it because it
 * changes what the view means, and an unsurfaced `scoped: false` is a tile that
 * lies in its title.
 */
export type OwnerCalendarResult =
  | {
      readonly ok: true;
      readonly locationId: string;
      readonly scoped: boolean;
      readonly monthLabel: string;
      readonly days: readonly CalendarDay[];
      readonly upcoming: readonly OwnerAppointment[];
    }
  | { readonly ok: false; readonly message: string };

/** Mirrors `OwnerCalendarResponse` in the route. */
export interface OwnerCalendarResponse {
  readonly calendar: OwnerCalendarResult;
  readonly warnings: readonly WidgetWarning[];
}
