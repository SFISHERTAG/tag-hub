import {
  getAppointments,
  formatTime,
  dayRange,
} from "@/lib/ghl/appointments";
import { getContact } from "@/lib/ghl/contacts";
import { getOpportunityForContact } from "@/lib/ghl/opportunities";
import { requireSession } from "@/lib/auth/session";
import { devLocationId, GhlConfigError } from "@/lib/ghl/tokens";
import {
  getFollowUpCandidates,
  getFollowUpConfig,
  DEFAULT_FOLLOW_UP_CONFIG,
} from "@/lib/ghl/store";
import {
  resolveFollowUpQueue,
  FOLLOW_UP_LOOKAHEAD_DAYS,
} from "@/lib/followup/queue";

export const dynamic = "force-dynamic";

export default async function FollowUpPage() {
  await requireSession();

  const locationId = devLocationId();
  if (!locationId) {
    return (
      <div className="max-w-2xl rounded-lg border border-warn/30 bg-warn-tint p-6 text-warn">
        <h2 className="text-base font-semibold">Setup needed</h2>
        <p className="mt-2 text-sm">
          No location configured. Set <code>GHL_LOCATION_ID</code> in{" "}
          <code>hub/.env.local</code>.
        </p>
      </div>
    );
  }

  let candidates;
  try {
    candidates = await getFollowUpCandidates(locationId);
  } catch (error) {
    if (error instanceof GhlConfigError) {
      return (
        <div className="max-w-2xl rounded-lg border border-warn/30 bg-warn-tint p-6 text-warn">
          <h2 className="text-base font-semibold">Setup needed</h2>
          <p className="mt-2 text-sm">{error.message}</p>
        </div>
      );
    }
    return (
      <div className="max-w-2xl rounded-lg border border-danger/30 bg-danger-tint p-6 text-danger">
        <h2 className="text-base font-semibold">Could not load follow-ups</h2>
        <p className="mt-2 font-mono text-xs whitespace-pre-wrap">
          {error instanceof Error ? error.message : String(error)}
        </p>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight">Follow-up queue</h1>
        <p className="text-sm text-ink-3">No follow-ups needed.</p>
      </div>
    );
  }

  // Enrich candidates with appointment and contact data
  const rangeStart = dayRange(-90);
  const rangeEnd = dayRange(FOLLOW_UP_LOOKAHEAD_DAYS);
  const allAppointments = await getAppointments(locationId, {
    startMs: rangeStart.startMs,
    endMs: rangeEnd.endMs,
  });

  // Shared with /today rather than reimplemented here. The inline version
  // this replaces treated any later appointment as a rebooking, including a
  // cancelled one — so a no-show whose replacement booking was then
  // cancelled silently dropped out of the queue, which is precisely the lead
  // this page exists to surface. It also skipped the aging rules /today
  // applies, so the two pages disagreed about the same contact.
  const config = await getFollowUpConfig(locationId).catch(() => DEFAULT_FOLLOW_UP_CONFIG);
  const stillOwed = resolveFollowUpQueue(candidates, allAppointments, config);

  const enriched = await Promise.all(
    stillOwed.map(async (candidate) => {
      const appointment = allAppointments.find((a) => a.id === candidate.appointmentId);
      if (!appointment?.contactId) return null;

      const contact = await getContact(locationId, appointment.contactId);
      const opportunity = await getOpportunityForContact(locationId, appointment.contactId);

      return {
        appointmentId: candidate.appointmentId,
        appointment,
        contact,
        opportunity,
        status: candidate.status,
        timing: candidate.timing,
        markedAt: new Date(candidate.markedAt),
      };
    }),
  );

  // `.filter(Boolean)` drops the nulls at runtime but does not narrow the
  // type — `Boolean` is not a type predicate, so the result stays
  // `(T | null)[]` and every field access below reports "possibly null". The
  // explicit predicate tells the compiler what the filter already guarantees.
  const validCandidates = enriched.filter(
    (item): item is NonNullable<typeof item> => item !== null,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Follow-up queue</h1>
        <span className="text-sm text-ink-3">
          {validCandidates.length} {validCandidates.length === 1 ? "contact" : "contacts"}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {validCandidates.map((item) => (
          <div
            key={item.appointmentId}
            className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">
                  {item.contact?.firstName || item.contact?.contactName || "Unknown"}
                </p>
                {item.contact?.companyName && (
                  <p className="text-xs text-ink-3">{item.contact.companyName}</p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
                  item.status === "noshow"
                    ? "bg-danger-tint text-danger"
                    : "bg-warn-tint text-warn"
                }`}
              >
                {item.status === "noshow" ? "No-show" : "DQ"}
              </span>
            </div>

            <div className="text-xs text-ink-2 space-y-1">
              <p>
                <span className="text-ink-3">Appointment:</span>{" "}
                {formatTime(item.appointment.startTime)} • {item.appointment.title || "Untitled"}
              </p>
              <p>
                <span className="text-ink-3">Marked:</span>{" "}
                {item.markedAt.toLocaleDateString()} ({item.timing})
              </p>
              {item.opportunity && (
                <p>
                  <span className="text-ink-3">Deal:</span> {item.opportunity.name}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-ink-3">
        Follow-ups clear when a new appointment is booked on the contact.
      </p>
    </div>
  );
}
