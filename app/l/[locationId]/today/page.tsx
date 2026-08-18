import {
  getAppointments,
  getCalendars,
  dayRange,
  formatTime,
} from "@/lib/ghl/appointments";
import { getSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { getFollowUpCandidates, getFollowUpConfig } from "@/lib/ghl/store";
import { GhlConfigError } from "@/lib/ghl/tokens";
import { StatusControls } from "./status-controls";
import { PrepPanel } from "./prep-panel";
import { FollowUpQueue } from "./follow-up-queue";

export const dynamic = "force-dynamic";

function AppointmentRow({
  locationId,
  appointment,
  calendarName,
}: {
  locationId: string;
  appointment: Awaited<ReturnType<typeof getAppointments>>[0];
  calendarName: string;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-semibold tabular-nums text-ink">
              {formatTime(appointment.startTime)}
            </span>
            <span className="truncate text-sm text-ink">
              {appointment.title || "Untitled"}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-ink-3">
            {calendarName}
            {appointment.status === "cancelled" && " · cancelled"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {appointment.contactId && (
            <PrepPanel
              locationId={locationId}
              contactId={appointment.contactId}
              contactLabel={appointment.title || "Contact"}
            />
          )}
          <StatusControls
            locationId={locationId}
            appointmentId={appointment.id}
            current={appointment.status}
            startTime={appointment.startTime}
            endTime={appointment.endTime}
            contactId={appointment.contactId}
            title={appointment.title}
          />
        </div>
      </div>
    </div>
  );
}

const OFFSET_LABELS: Record<string, { days: number; label: string }> = {
  yesterday: { days: -1, label: "Yesterday" },
  today: { days: 0, label: "Today" },
  tomorrow: { days: 1, label: "Tomorrow" },
};

/** How far ahead to look when checking whether a follow-up contact already has a new booking (story 2.8 AC4). */
const FOLLOW_UP_LOOKAHEAD_DAYS = 30;

/**
 * Filters follow-up candidates down to ones still owed a follow-up: cleared
 * once a newer appointment is booked (AC4), aged out past the configured
 * threshold (AC2/AC3). Plain function, not a component — keeps `Date.now()`
 * out of TodayPage's render body.
 */
function resolveFollowUpQueue(
  candidates: Awaited<ReturnType<typeof getFollowUpCandidates>>,
  nearbyAppointments: Awaited<ReturnType<typeof getAppointments>>,
  config: { mode: "days" | "attempts"; value: number },
): Awaited<ReturnType<typeof getFollowUpCandidates>> {
  const latestBookingByContact = new Map<string, number>();
  for (const appt of nearbyAppointments) {
    if (!appt.contactId || appt.status === "cancelled") continue;
    const startsAt = Date.parse(appt.startTime);
    if (Number.isNaN(startsAt)) continue;
    const current = latestBookingByContact.get(appt.contactId) ?? -Infinity;
    if (startsAt > current) latestBookingByContact.set(appt.contactId, startsAt);
  }

  const now = Date.now();

  return candidates.filter((candidate) => {
    const newestBooking = latestBookingByContact.get(candidate.contactId);
    if (newestBooking !== undefined && newestBooking > candidate.markedAt) return false;

    if (config.mode === "days") {
      const daysSince = (now - candidate.markedAt) / 86_400_000;
      if (daysSince > config.value) return false;
    } else if (candidate.attempts > config.value) {
      return false;
    }

    return true;
  });
}

export default async function TodayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { locationId } = await params;
  const { day } = await searchParams;
  const selected = OFFSET_LABELS[day ?? "today"] ?? OFFSET_LABELS.today;
  const session = await getSession();

  let appointments;
  let calendarNames = new Map<string, string>();
  try {
    const range = dayRange(selected.days);
    const [list, calendars] = await Promise.all([
      getAppointments(locationId, range),
      getCalendars(locationId),
    ]);
    appointments = list;
    calendarNames = new Map(calendars.map((c) => [c.id, c.name]));
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
        <h2 className="text-base font-semibold">Could not load appointments</h2>
        <p className="mt-2 font-mono text-xs whitespace-pre-wrap">
          {error instanceof Error ? error.message : String(error)}
        </p>
      </div>
    );
  }

  const marked = appointments.filter(
    (a) => a.status === "showed" || a.status === "noshow",
  ).length;

  // Story 2.8: follow-up queue. One bulk fetch of nearby bookings (not one
  // per candidate) is enough to tell whether a contact already has a newer
  // appointment on the books, which is what clears them from the queue.
  let followUpCandidates: Awaited<ReturnType<typeof getFollowUpCandidates>> = [];
  const followUpConfig = await getFollowUpConfig(locationId).catch(() => undefined);
  try {
    const lookahead = dayRange(FOLLOW_UP_LOOKAHEAD_DAYS);
    const lookback = dayRange(-FOLLOW_UP_LOOKAHEAD_DAYS);
    const [candidates, nearbyAppointments] = await Promise.all([
      getFollowUpCandidates(locationId),
      getAppointments(locationId, { startMs: lookback.startMs, endMs: lookahead.endMs }),
    ]);

    followUpCandidates = resolveFollowUpQueue(
      candidates,
      nearbyAppointments,
      followUpConfig ?? { mode: "days", value: 7 },
    );
  } catch {
    // Follow-up queue is supplementary context; a Firestore hiccup shouldn't
    // block the appointment list itself from rendering.
  }

  const canConfigureFollowUp = hasAnyRole(session?.currentRole, ["client_manager", "client_owner"]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold tracking-tight">
          {selected.label}
        </h1>
        <span className="text-sm text-ink-3">
          {appointments.length}{" "}
          {appointments.length === 1 ? "appointment" : "appointments"}
        </span>
        {appointments.length > 0 && (
          <span className="text-sm text-ink-3">
            · {marked} marked
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {Object.entries(OFFSET_LABELS).map(([key, value]) => (
          <a
            key={key}
            href={`/l/${locationId}/today?day=${key}`}
            className={
              value.label === selected.label
                ? "rounded-full bg-chrome px-3 py-1 text-xs font-semibold text-accent"
                : "rounded-full border border-line-strong px-3 py-1 text-xs text-ink-2 hover:border-line-strong"
            }
          >
            {value.label}
          </a>
        ))}
      </div>

      {appointments.length === 0 ? (
        <p className="text-sm text-ink-3">
          Nothing booked for {selected.label.toLowerCase()}.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {appointments.map((appointment) => (
            <AppointmentRow
              key={appointment.id}
              locationId={locationId}
              appointment={appointment}
              calendarName={calendarNames.get(appointment.calendarId) ?? "Calendar"}
            />
          ))}
        </div>
      )}

      <FollowUpQueue
        locationId={locationId}
        candidates={followUpCandidates}
        config={followUpConfig ?? { mode: "days", value: 7 }}
        canConfigure={canConfigureFollowUp}
      />
    </div>
  );
}
