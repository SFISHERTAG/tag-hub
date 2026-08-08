import {
  getAppointments,
  getCalendars,
  dayRange,
  formatTime,
} from "@/lib/ghl/appointments";
import { devLocationId, GhlConfigError } from "@/lib/ghl/tokens";
import { StatusControls } from "./status-controls";

export const dynamic = "force-dynamic";

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
  const { day } = await searchParams;
  const selected = OFFSET_LABELS[day ?? "today"] ?? OFFSET_LABELS.today;

  const locationId = devLocationId();
  if (!locationId) {
    return (
      <div className="max-w-2xl rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-900">
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
        <div className="max-w-2xl rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-900">
          <h2 className="text-base font-semibold">Setup needed</h2>
          <p className="mt-2 text-sm">{error.message}</p>
        </div>
      );
    }
    return (
      <div className="max-w-2xl rounded-lg border border-red-300 bg-red-50 p-6 text-red-900">
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
        <span className="text-sm text-neutral-500">
          {appointments.length}{" "}
          {appointments.length === 1 ? "appointment" : "appointments"}
        </span>
        {appointments.length > 0 && (
          <span className="text-sm text-neutral-500">
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
                ? "rounded-full bg-black px-3 py-1 text-xs font-semibold text-[#ebc507]"
                : "rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:border-neutral-400"
            }
          >
            {value.label}
          </a>
        ))}
      </div>

      {appointments.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Nothing booked for {selected.label.toLowerCase()}.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {appointments.map((appointment) => (
            <div
              key={appointment.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-3">
                  <span className="text-sm font-semibold tabular-nums text-neutral-900">
                    {formatTime(appointment.startTime)}
                  </span>
                  <span className="truncate text-sm text-neutral-900">
                    {appointment.title || "Untitled"}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-neutral-500">
                  {calendarNames.get(appointment.calendarId) ?? "Calendar"}
                  {appointment.status === "cancelled" && " · cancelled"}
                </p>
              </div>

              <StatusControls
                locationId={locationId}
                appointmentId={appointment.id}
                current={appointment.status}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
