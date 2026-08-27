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

import type { SampleDataDisclosure } from '../../clients/services/client.model';

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
