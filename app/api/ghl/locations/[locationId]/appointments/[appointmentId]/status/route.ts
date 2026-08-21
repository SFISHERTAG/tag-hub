import "server-only";
import { after, type NextRequest } from "next/server";
import { getImpersonation } from "@/lib/auth/session";
import { setAppointmentStatus, type AppointmentStatus } from "@/lib/ghl/appointments";
import { getContact } from "@/lib/ghl/contacts";
import { displayName } from "@/lib/ghl/format";
import { classifyTiming, saveAppointmentOutcome, type OutcomeTiming } from "@/lib/ghl/store";
import { logAction } from "@/lib/audit/store";
import { dispatchShowed } from "@/lib/meta/conversions";
import { withErrorHandling } from "@/lib/api/errorInterceptor";
import { gateLocationAndId } from "@/app/api/ghl/_lib/gate";
import { badRequest, ghlJson, isSafeGhlId, readJsonBody } from "@/app/api/ghl/_lib/respond";

export const dynamic = "force-dynamic";

const CONTEXT = "PUT /api/ghl/locations/[locationId]/appointments/[appointmentId]/status";

const STATUSES = [
  "new",
  "confirmed",
  "showed",
  "noshow",
  "cancelled",
  "invalid",
] as const satisfies readonly AppointmentStatus[];

/** Longest note/title we will denormalize into the outcome record. */
const MAX_TITLE = 500;

export type MarkAppointmentRequest = {
  status: AppointmentStatus;
  /** ISO timestamps from the row being marked. They decide the outcome's
   * timing classification, which GHL has no concept of. */
  startTime: string;
  endTime: string;
  contactId?: string;
  title?: string;
};

export type MarkAppointmentResponse = {
  appointmentId: string;
  status: AppointmentStatus;
  /**
   * Where the mark fell relative to the appointment, or null when the timing
   * record could not be written. Null is reported rather than hidden: GHL has
   * the status either way, but a missing timing record changes how this
   * appointment counts toward show rate.
   */
  timing: OutcomeTiming | null;
  timingRecorded: boolean;
};

/**
 * PUT /api/ghl/locations/[locationId]/appointments/[appointmentId]/status
 *
 * Ports `markAppointment`. GHL stays the system of record for the status; the
 * Firestore write alongside it records *when* the mark happened relative to the
 * appointment, which is what separates a pre-call DQ (bad targeting, no call
 * happened) from an on-call DQ (real person, wrong fit). Those belong on
 * opposite sides of a show-rate calculation.
 *
 * The GHL write is what must succeed. Losing the timing record degrades a
 * metric; failing the status write loses the closer's work — so the first is
 * reported in the response and the second is an error.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string; appointmentId: string }> },
) {
  const { locationId, appointmentId } = await params;
  const gate = await gateLocationAndId(locationId, appointmentId, "appointment", CONTEXT);
  if (!gate.ok) return gate.response;
  const { session } = gate;

  const body = await readJsonBody(request);
  if (!body) return badRequest(CONTEXT, "Expected a JSON object body.");

  const status = body.status;
  if (typeof status !== "string" || !STATUSES.includes(status as AppointmentStatus)) {
    return badRequest(CONTEXT, `status must be one of: ${STATUSES.join(", ")}.`);
  }

  const startTime = body.startTime;
  const endTime = body.endTime;
  if (typeof startTime !== "string" || typeof endTime !== "string") {
    return badRequest(CONTEXT, "startTime and endTime are required ISO timestamps.");
  }
  const startsAt = Date.parse(startTime);
  const endsAt = Date.parse(endTime);
  if (Number.isNaN(startsAt) || Number.isNaN(endsAt)) {
    return badRequest(CONTEXT, "startTime and endTime must be parseable timestamps.");
  }

  let contactId: string | undefined;
  if (body.contactId !== undefined) {
    if (typeof body.contactId !== "string" || !isSafeGhlId(body.contactId)) {
      return badRequest(CONTEXT, "Malformed contact id.");
    }
    contactId = body.contactId;
  }

  const title =
    typeof body.title === "string" ? body.title.slice(0, MAX_TITLE) : undefined;
  const marked = status as AppointmentStatus;

  return ghlJson<MarkAppointmentResponse>(CONTEXT, async () => {
    await setAppointmentStatus(locationId, appointmentId, marked);

    // Attributed to the acting user, not the impersonated client.
    const impersonation = await getImpersonation();
    await logAction(locationId, {
      actorId: session.uid,
      actorRole: session.currentRole,
      action: "appointment.outcome",
      targetType: "appointment",
      targetId: appointmentId,
      auditEntryId: impersonation?.auditEntryId,
      metadata: { status: marked },
    });

    // Story 6.2: teach Meta's algorithm that this contact showed up, not just
    // that they filled out a form. Scheduled via after() so it runs once the
    // response has gone out — a Meta outage must never slow down or fail the
    // outcome save above, which is the closer's actual work.
    if (marked === "showed" && contactId) {
      const showedContactId = contactId;
      after(() => dispatchShowed(locationId, appointmentId, showedContactId));
    }

    const markedAt = Date.now();
    const timing = classifyTiming(markedAt, startsAt, endsAt);

    // Contact name is denormalized here, once, on the write path — so the
    // follow-up queue can render later without a per-row contact fetch.
    // A failure costs a display name, not the outcome record.
    const named = contactId
      ? await withErrorHandling(`getContact(${locationId}, ${contactId})`, () =>
          getContact(locationId, contactId),
        )
      : null;
    const contactName = named?.data ? displayName(named.data) : undefined;

    // Analytics context, not the closer's work. If Firestore is unreachable the
    // status is already in GHL, which is what matters — but the caller is told,
    // rather than being handed a silent success.
    const recorded = await withErrorHandling(
      `saveAppointmentOutcome(${locationId}, ${appointmentId})`,
      () =>
        saveAppointmentOutcome(locationId, appointmentId, {
          status: marked,
          timing,
          markedAt,
          appointmentStartsAt: startsAt,
          appointmentEndsAt: endsAt,
          contactId,
          contactName,
          appointmentTitle: title,
        }),
    );

    return {
      appointmentId,
      status: marked,
      timing: recorded.error === null ? timing : null,
      timingRecorded: recorded.error === null,
    };
  });
}
