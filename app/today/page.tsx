import {
  getAppointments,
  getCalendars,
  dayRange,
  formatTime,
} from "@/lib/ghl/appointments";
import { getContact, getNotes } from "@/lib/ghl/contacts";
import { getOpportunityForContact } from "@/lib/ghl/opportunities";
import { requireSession } from "@/lib/auth/session";
import { devLocationId, GhlConfigError } from "@/lib/ghl/tokens";
import { StatusControls } from "./status-controls";
import { PrepPanel } from "./prep-panel";

export const dynamic = "force-dynamic";

async function AppointmentRow({
  locationId,
  appointment,
  calendarName,
}: {
  locationId: string;
  appointment: Awaited<ReturnType<typeof getAppointments>>[0];
  calendarName: string;
}) {
  let contact = null;
  let notes: Awaited<ReturnType<typeof getNotes>> = [];
  let opportunity = null;

  if (appointment.contactId) {
    try {
      [contact, notes, opportunity] = await Promise.all([
        getContact(locationId, appointment.contactId),
        getNotes(locationId, appointment.contactId),
        getOpportunityForContact(locationId, appointment.contactId),
      ]);
    } catch {
      // If prep data fails to load, show the appointment without it
    }
  }

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

        <StatusControls
          locationId={locationId}
          appointmentId={appointment.id}
          current={appointment.status}
          startTime={appointment.startTime}
          endTime={appointment.endTime}
        />
      </div>

      {contact && (
        <div className="border-t border-line px-4 py-3">
          <PrepPanel contact={contact} notes={notes} opportunity={opportunity} />
        </div>
      )}
    </div>
  );
}

const OFFSET_LABELS: Record<string, { days: number; label: string }> = {
  yesterday: { days: -1, label: "Yesterday" },
  today: { days: 0, label: "Today" },
  tomorrow: { days: 1, label: "Tomorrow" },
};

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  await requireSession();

  const { day } = await searchParams;
  const selected = OFFSET_LABELS[day ?? "today"] ?? OFFSET_LABELS.today;

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
            href={`/today?day=${key}`}
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
    </div>
  );
}
