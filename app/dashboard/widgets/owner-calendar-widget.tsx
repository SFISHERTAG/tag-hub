import { Panel, Badge } from "../../ui";
import { StatusControls } from "@/app/l/[locationId]/today/status-controls";
import { formatTime } from "@/lib/ghl/format";
import type { OwnerCalendarResult, OwnerAppointment } from "@/lib/dashboard/owner-calendar";

const STATUS_TONE: Record<string, "ok" | "warn" | "danger" | "neutral" | "info"> = {
  confirmed: "ok",
  showed: "ok",
  new: "info",
  noshow: "danger",
  cancelled: "neutral",
  invalid: "neutral",
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function OwnerCalendarWidget({ result }: { result: OwnerCalendarResult }) {
  if (!result.ok) {
    return (
      <Panel title="My calendar">
        <p className="text-sm text-ink-3">{result.message}</p>
      </Panel>
    );
  }

  const { locationId, scoped, monthLabel, days, upcoming } = result;

  return (
    <Panel title="My calendar" meta={monthLabel}>
      <div className="space-y-4">
        {!scoped && (
          <p className="text-xs text-ink-3">
            Showing the location&apos;s full calendar — no owner is configured for this tenant yet.
          </p>
        )}

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="text-xs font-medium text-ink-3">
              {label}
            </div>
          ))}
          {days.map((day) => (
            <div
              key={day.date}
              className={`min-h-[2.5rem] rounded-md border px-1 py-1 text-xs ${
                day.isToday
                  ? "border-accent bg-accent/10"
                  : "border-line"
              } ${day.isCurrentMonth ? "" : "opacity-40"}`}
            >
              <div className="text-right text-ink-3">{day.dayOfMonth}</div>
              {day.appointments.length > 0 && (
                <div className="mt-0.5 flex justify-end">
                  <Badge tone={STATUS_TONE[day.appointments[0].status] ?? "neutral"}>
                    {day.appointments.length}
                  </Badge>
                </div>
              )}
            </div>
          ))}
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium text-ink">Upcoming</h4>
          {upcoming.length === 0 ? (
            <p className="text-sm text-ink-3">No upcoming calls scheduled.</p>
          ) : (
            <ol className="space-y-2">
              {upcoming.map((appointment) => (
                <UpcomingRow key={appointment.id} locationId={locationId} appointment={appointment} />
              ))}
            </ol>
          )}
        </div>
      </div>
    </Panel>
  );
}

function UpcomingRow({ locationId, appointment }: { locationId: string; appointment: OwnerAppointment }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{appointment.title}</p>
        <p className="text-xs text-ink-3">
          {new Date(appointment.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })} ·{" "}
          {formatTime(appointment.startTime)}–{formatTime(appointment.endTime)}
        </p>
      </div>
      {appointment.isPastOrToday ? (
        <StatusControls
          locationId={locationId}
          appointmentId={appointment.id}
          current={appointment.status}
          startTime={appointment.startTime}
          endTime={appointment.endTime}
        />
      ) : (
        <Badge tone={STATUS_TONE[appointment.status] ?? "neutral"}>{appointment.status}</Badge>
      )}
    </li>
  );
}
