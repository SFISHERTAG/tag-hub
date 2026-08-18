"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getSession, getImpersonation } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import {
  setAppointmentStatus,
  type AppointmentStatus,
} from "@/lib/ghl/appointments";
import { getContact, getNotes, type Contact, type Note } from "@/lib/ghl/contacts";
import { getOpportunityForContact, type Opportunity } from "@/lib/ghl/opportunities";
import { displayName } from "@/lib/ghl/format";
import {
  classifyTiming,
  saveAppointmentOutcome,
  saveFollowUpConfig,
  type FollowUpConfig,
} from "@/lib/ghl/store";
import { logAction } from "@/lib/audit/store";
import { dispatchShowed } from "@/lib/meta/conversions";

/**
 * Marks an appointment's outcome.
 *
 * The status goes to GHL, which stays the system of record and keeps the value
 * visible to anyone working there directly. Alongside it we record *when* the
 * mark happened relative to the appointment, because GHL does not — and that
 * timing is what separates a pre-call DQ (bad targeting, no call happened)
 * from an on-call DQ (real person, wrong fit). Those belong on opposite sides
 * of a show-rate calculation.
 *
 * The GHL write is what must succeed. Losing the timing record degrades a
 * metric; failing the status write loses the closer's work.
 */
export async function markAppointment(
  locationId: string,
  appointmentId: string,
  status: AppointmentStatus,
  appointment: {
    startTime: string;
    endTime: string;
    contactId?: string;
    title?: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Server actions are callable endpoints in their own right. Guarding the page
  // that renders the button does not guard this, so it checks for itself.
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Not signed in." };
  }

  try {
    await setAppointmentStatus(locationId, appointmentId, status);
    // Attributed to the acting user, not the impersonated client — see
    // docs/stories/3.4. auditEntryId links this write back to the
    // impersonation session that produced it (Story 3.5 AC4), when active.
    const impersonation = await getImpersonation();
    await logAction(locationId, {
      actorId: session.uid,
      actorRole: session.currentRole,
      action: "appointment.outcome",
      targetType: "appointment",
      targetId: appointmentId,
      auditEntryId: impersonation?.auditEntryId,
      metadata: { status },
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // Story 6.2: teach Meta's algorithm that this contact showed up, not just
  // that they filled out a form. Scheduled via after() so it runs once the
  // response has gone out — a Meta outage must never be able to slow down or
  // fail the outcome save above, which is the closer's actual work.
  if (status === "showed" && appointment.contactId) {
    const contactId = appointment.contactId;
    after(() => dispatchShowed(locationId, appointmentId, contactId));
  }

  try {
    const markedAt = Date.now();
    const startsAt = Date.parse(appointment.startTime);
    const endsAt = Date.parse(appointment.endTime);

    if (!Number.isNaN(startsAt) && !Number.isNaN(endsAt)) {
      // Contact name is fetched here, once, on the write path — not on
      // /today's read path — so the follow-up queue (story 2.8) can render
      // later without a per-row contact fetch of its own.
      let contactName: string | undefined;
      if (appointment.contactId) {
        try {
          const contact = await getContact(locationId, appointment.contactId);
          if (contact) contactName = displayName(contact);
        } catch {
          // Denormalized display data only; the outcome record still saves.
        }
      }

      await saveAppointmentOutcome(locationId, appointmentId, {
        status,
        timing: classifyTiming(markedAt, startsAt, endsAt),
        markedAt,
        appointmentStartsAt: startsAt,
        appointmentEndsAt: endsAt,
        contactId: appointment.contactId,
        contactName,
        appointmentTitle: appointment.title,
      });
    }
  } catch {
    // Timing is analytics context, not the closer's work. If Firestore is
    // unreachable the status is already saved in GHL, which is what matters.
  }

  revalidatePath(`/l/${locationId}/today`);
  return { ok: true };
}

/**
 * Fetches call-prep data for one contact — attribution, pipeline stage/value,
 * and notes. Called only when a closer opens the prep modal for a specific
 * appointment row, never during /today's initial render (story 2.7 AC4).
 */
export async function getPrepData(
  locationId: string,
  contactId: string,
): Promise<
  | { ok: true; contact: Contact; notes: Note[]; opportunity: Opportunity | null }
  | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };

  try {
    const [contact, notes, opportunity] = await Promise.all([
      getContact(locationId, contactId),
      getNotes(locationId, contactId),
      getOpportunityForContact(locationId, contactId),
    ]);
    if (!contact) return { ok: false, error: "Contact not found." };
    return { ok: true, contact, notes, opportunity };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Updates the follow-up queue's aging-out threshold. Restricted to roles that
 * manage closers, matching story 2.8's "sales-manager-configurable" — on the
 * client side that's the closing manager or the owner above them.
 */
export async function setFollowUpConfig(
  locationId: string,
  config: FollowUpConfig,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!hasAnyRole(session.currentRole, ["client_manager", "client_owner"])) {
    return { ok: false, error: "Only a closing manager or owner can change this." };
  }
  if (!Number.isFinite(config.value) || config.value <= 0) {
    return { ok: false, error: "Threshold must be a positive number." };
  }

  try {
    await saveFollowUpConfig(locationId, config);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  revalidatePath(`/l/${locationId}/today`);
  return { ok: true };
}
