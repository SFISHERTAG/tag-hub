import "server-only";
import { listContactsAddedSince } from "@/lib/ghl/contacts";
import { getAppointments } from "@/lib/ghl/appointments";
import { getPipelines } from "@/lib/ghl/pipelines";
import { getOpportunities } from "@/lib/ghl/opportunities";
import { GhlConfigError, LocationNotAuthorizedError } from "@/lib/ghl/tokens";
import { loadAppointmentOutcomes } from "@/lib/ghl/store";

export type FunnelStageCount = {
  stage: "Leads" | "Booked" | "Showed" | "Closed";
  count: number;
};

export type FunnelCountsResult =
  | {
      ok: true;
      stages: FunnelStageCount[];
      /**
       * Booked minus pre-call DQ — the correct denominator for the
       * Showed stage's conversion rate per docs/stories/6.4. Raw Booked
       * count (stages[1].count) still includes pre-call DQs so the funnel
       * shows the true booking volume; this is only for the show-rate math.
       */
      showRateDenominator: number;
      dqBreakdown: { preCall: number; onCall: number };
      /**
       * True when the contact fetch hit its page cap and this funnel is an
       * undercount. It used to be reported as a complete result: the lead
       * fetch took one 100-contact page and filtered it client-side, so any
       * location with more than 100 contacts in the window under-reported
       * every stage while still returning ok: true.
       */
      truncated: boolean;
    }
  | { ok: false; message: string };

/**
 * Leads -> booked -> showed -> closed, over the last `days` days.
 *
 * Appointments are fetched over a wider window than the lead window itself,
 * since a lead added near the end of the window may book a call after it —
 * the appointment's own start time can fall outside the `days` cutoff even
 * though the lead that booked it doesn't. Matching is done by contactId
 * against the lead set, not by appointment date, so this widens correctly.
 *
 * No caching per AC5: every `ghl()` call here defaults to revalidate: 0.
 */
export async function getFunnelCounts(
  locationId: string,
  days = 30,
): Promise<FunnelCountsResult> {
  try {
    const now = Date.now();
    const windowStartMs = now - days * 24 * 60 * 60 * 1000;

    const { contacts, truncated } = await listContactsAddedSince(locationId, windowStartMs);
    const leads = contacts.filter((contact) => {
      const addedMs = Date.parse(contact.dateAdded ?? "");
      return !Number.isNaN(addedMs) && addedMs >= windowStartMs;
    });
    const leadIds = new Set(leads.map((c) => c.id));

    const appointments = await getAppointments(locationId, {
      startMs: windowStartMs,
      endMs: now,
    });
    const leadAppointments = appointments.filter(
      (a) => a.contactId && leadIds.has(a.contactId),
    );

    const bookedContactIds = new Set(
      leadAppointments.map((a) => a.contactId!),
    );
    const showedContactIds = new Set(
      leadAppointments.filter((a) => a.status === "showed").map((a) => a.contactId!),
    );

    // Story 6.4: split DQ by timing. A pre-call DQ (nobody showed, bad
    // targeting) drops the contact from the show-rate denominator; an
    // on-call DQ (real person, wrong fit) stays in it. Timing comes from the
    // Firestore outcome record (story 2.3); an appointment marked invalid
    // with no outcome record has unknown timing and is kept in the
    // denominator, per the story's conservative-default dev note.
    const invalidAppointments = leadAppointments.filter((a) => a.status === "invalid");
    const outcomes = await loadAppointmentOutcomes(
      locationId,
      invalidAppointments.map((a) => a.id),
    );

    const preCallDqContactIds = new Set<string>();
    const onCallDqContactIds = new Set<string>();
    for (const appt of invalidAppointments) {
      if (!appt.contactId) continue;
      // A contact who did show, on some other appointment, is not a pre-call
      // DQ no matter what a second appointment says. These sets are keyed by
      // contact while the outcomes are per appointment, so without this a
      // contact with both a showed appointment and a pre-call DQ came out of
      // the denominator while staying in the numerator — which is how a show
      // rate over 100% renders.
      if (showedContactIds.has(appt.contactId)) continue;

      const outcome = outcomes.get(appt.id);
      if (outcome?.timing === "pre-call") {
        preCallDqContactIds.add(appt.contactId);
      } else {
        onCallDqContactIds.add(appt.contactId);
      }
    }

    const showRateDenominator = bookedContactIds.size - preCallDqContactIds.size;

    const pipelines = await getPipelines(locationId);
    const pipeline = pipelines[0];
    let closedCount = 0;
    if (pipeline) {
      const won = await getOpportunities(locationId, pipeline.id, { status: "won" });
      closedCount = won.filter((o) => o.contact?.id && leadIds.has(o.contact.id)).length;
    }

    return {
      ok: true,
      stages: [
        { stage: "Leads", count: leads.length },
        { stage: "Booked", count: bookedContactIds.size },
        { stage: "Showed", count: showedContactIds.size },
        { stage: "Closed", count: closedCount },
      ],
      showRateDenominator,
      dqBreakdown: { preCall: preCallDqContactIds.size, onCall: onCallDqContactIds.size },
      truncated,
    };
  } catch (error) {
    if (error instanceof GhlConfigError || error instanceof LocationNotAuthorizedError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Scoped to the caller's own tenant. `locationId` is resolved from the
 * session by the dashboard page (see lib/dashboard/location-selection.ts)
 * and access-checked there. These fetchers used to read a single global
 * `GHL_LOCATION_ID` env var instead, which meant every client tenant that
 * added this widget saw whichever location that var happened to point at.
 */
export async function getDashboardFunnelCounts(
  locationId: string,
  days = 30,
): Promise<FunnelCountsResult> {
  return getFunnelCounts(locationId, days);
}
