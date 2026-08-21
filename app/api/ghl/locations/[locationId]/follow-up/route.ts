import "server-only";
import type { NextRequest } from "next/server";
import { dayRange, getAppointments, type Appointment } from "@/lib/ghl/appointments";
import { getContact, type Contact } from "@/lib/ghl/contacts";
import { getOpportunityForContact, type Opportunity } from "@/lib/ghl/opportunities";
import { displayName } from "@/lib/ghl/format";
import {
  DEFAULT_FOLLOW_UP_CONFIG,
  getFollowUpCandidates,
  getFollowUpConfig,
  type FollowUpCandidate,
  type FollowUpConfig,
} from "@/lib/ghl/store";
import { FOLLOW_UP_LOOKAHEAD_DAYS, resolveFollowUpQueue } from "@/lib/followup/queue";
import { withErrorHandling } from "@/lib/api/errorInterceptor";
import { canConfigureFollowUp, gateLocation } from "@/app/api/ghl/_lib/gate";
import { badRequest, ghlJson, readLimit } from "@/app/api/ghl/_lib/respond";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/ghl/locations/[locationId]/follow-up";

/**
 * How far back to look for a rebooking.
 *
 * The legacy /today queue looked back 30 days and the legacy /followup page
 * looked back 90, so the two could disagree about the same contact: a
 * candidate marked 45 days ago whose replacement booking landed 35 days ago
 * read as rebooked on one screen and still owed on the other. 90 is the wider
 * and the more correct of the two — a longer window can only ever find a
 * genuine rebooking the shorter one missed.
 */
const LOOKBACK_DAYS = 90;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
/** Enrichment costs two GHL calls per row. The page limit bounds it. */
const MAX_ENRICH = 50;

export type FollowUpEntry = FollowUpCandidate & {
  /** The appointment that was missed, when it still falls inside the lookback
   * window. Null does not clear the candidate — the outcome record carries the
   * denormalized name and title precisely so a row can render without it. */
  appointment: Appointment | null;
  /** Null unless `enrich=1` was requested. */
  contact: (Contact & { displayName: string }) | null;
  /** Null unless `enrich=1` was requested, or the contact has no deal. */
  opportunity: Opportunity | null;
};

export type FollowUpResponse = {
  config: FollowUpConfig;
  /** Cosmetic gating hint. The config endpoint re-checks the role itself. */
  canConfigure: boolean;
  lookaheadDays: number;
  lookbackDays: number;
  /** Candidates still owed a follow-up, before the page limit. */
  total: number;
  truncated: boolean;
  enriched: boolean;
  /** True when the saved threshold could not be read and the default was used —
   * the threshold changes which candidates survive, so a fallback is reported. */
  configFallback: boolean;
  candidates: FollowUpEntry[];
};

/**
 * GET /api/ghl/locations/[locationId]/follow-up?enrich=1&limit=50
 *
 * The one follow-up queue, serving both the today screen's inline panel and
 * the dedicated follow-up screen. `resolveFollowUpQueue` is the shared rule and
 * is not reimplemented here — it is what excludes CANCELLED appointments when
 * deciding whether a contact rebooked. A cancelled booking is not a rebooking;
 * it is the opposite, and treating it as one silently dropped exactly the lead
 * this queue exists to surface.
 *
 * `enrich=1` adds the contact and deal per row, two GHL calls each. The today
 * screen should not ask for it (Story 2.8 AC5: no per-row fetch); the dedicated
 * screen should.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> },
) {
  const { locationId } = await params;
  const gate = await gateLocation(locationId, CONTEXT);
  if (!gate.ok) return gate.response;

  const search = request.nextUrl.searchParams;

  const limit = readLimit(search.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
  if (limit === null) {
    return badRequest(CONTEXT, `limit must be a whole number from 1 to ${MAX_LIMIT}.`);
  }

  const rawEnrich = search.get("enrich");
  if (rawEnrich !== null && rawEnrich !== "0" && rawEnrich !== "1") {
    return badRequest(CONTEXT, "enrich must be 0 or 1.");
  }
  const enrich = rawEnrich === "1";

  return ghlJson<FollowUpResponse>(CONTEXT, async () => {
    const savedConfig = await withErrorHandling(`getFollowUpConfig(${locationId})`, () =>
      getFollowUpConfig(locationId),
    );
    const config = savedConfig.data ?? DEFAULT_FOLLOW_UP_CONFIG;

    const [candidates, nearbyAppointments] = await Promise.all([
      getFollowUpCandidates(locationId),
      getAppointments(locationId, {
        startMs: dayRange(-LOOKBACK_DAYS).startMs,
        endMs: dayRange(FOLLOW_UP_LOOKAHEAD_DAYS).endMs,
      }),
    ]);

    const stillOwed = resolveFollowUpQueue(candidates, nearbyAppointments, config);
    const page = stillOwed.slice(0, limit);
    const byId = new Map(nearbyAppointments.map((appointment) => [appointment.id, appointment]));

    const entries: FollowUpEntry[] = await Promise.all(
      page.map(async (candidate, index): Promise<FollowUpEntry> => {
        const appointment = byId.get(candidate.appointmentId) ?? null;
        const base: FollowUpEntry = {
          ...candidate,
          appointment,
          contact: null,
          opportunity: null,
        };
        if (!enrich || index >= MAX_ENRICH) return base;

        const [contact, opportunity] = await Promise.all([
          getContact(locationId, candidate.contactId),
          getOpportunityForContact(locationId, candidate.contactId),
        ]);

        return {
          ...base,
          contact: contact ? { ...contact, displayName: displayName(contact) } : null,
          opportunity,
        };
      }),
    );

    return {
      config,
      canConfigure: canConfigureFollowUp(gate.session),
      lookaheadDays: FOLLOW_UP_LOOKAHEAD_DAYS,
      lookbackDays: LOOKBACK_DAYS,
      total: stillOwed.length,
      truncated: stillOwed.length > page.length,
      enriched: enrich,
      configFallback: savedConfig.error !== null,
      candidates: entries,
    };
  });
}
