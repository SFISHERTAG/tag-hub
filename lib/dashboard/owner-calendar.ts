import "server-only";
import { getAppointments, type Appointment, type AppointmentStatus } from "@/lib/ghl/appointments";
import { getTenant } from "@/lib/ghl/tenants";
import { GhlConfigError, LocationNotAuthorizedError } from "@/lib/ghl/tokens";

export type OwnerAppointment = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  /** Today or past — the dashboard links these to the same status controls Story 2.3 built. */
  isPastOrToday: boolean;
};

export type CalendarDay = {
  /** ISO date, e.g. "2026-08-18". */
  date: string;
  dayOfMonth: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  appointments: OwnerAppointment[];
};

export type OwnerCalendarResult =
  | {
      ok: true;
      locationId: string;
      /** False when the tenant has no `ownerGhlUserId` configured — falls back to the whole location's calendar. */
      scoped: boolean;
      monthLabel: string;
      days: CalendarDay[];
      upcoming: OwnerAppointment[];
    }
  | { ok: false; message: string };

function toOwnerAppointment(apt: Appointment, now: number): OwnerAppointment {
  return {
    id: apt.id,
    title: apt.title || "Untitled call",
    startTime: apt.startTime,
    endTime: apt.endTime,
    status: apt.status,
    isPastOrToday: Date.parse(apt.startTime) <= endOfDay(now),
  };
}

function endOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function toDateKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Month grid range: full calendar weeks covering the current month (Sun–Sat). */
function monthGridRange(now: Date): { startMs: number; endMs: number; monthLabel: string } {
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  gridStart.setHours(0, 0, 0, 0);

  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));
  gridEnd.setHours(23, 59, 59, 999);

  return {
    startMs: gridStart.getTime(),
    endMs: gridEnd.getTime(),
    monthLabel: firstOfMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  };
}

/**
 * The client owner's own calendar: month grid + upcoming list, scoped to
 * appointments where they're the assigned staff member (see
 * `Tenant.ownerGhlUserId`). If no owner is configured for the tenant, this
 * falls back to the location's whole calendar rather than showing nothing —
 * a client with no admin-configured owner still gets a usable view.
 */
export async function getOwnerCalendar(locationId: string): Promise<OwnerCalendarResult> {
  if (!locationId) {
    return { ok: false, message: "No GHL location configured yet." };
  }

  try {
    const tenant = await getTenant(locationId);
    const now = new Date();
    const nowMs = now.getTime();
    const { startMs, endMs, monthLabel } = monthGridRange(now);

    // Upcoming list can extend past the visible month grid.
    const upcomingHorizon = new Date(now);
    upcomingHorizon.setDate(upcomingHorizon.getDate() + 60);
    const fetchStart = Math.min(startMs, nowMs);
    const fetchEnd = Math.max(endMs, upcomingHorizon.getTime());

    const allAppointments = await getAppointments(locationId, { startMs: fetchStart, endMs: fetchEnd });
    const scoped = Boolean(tenant.ownerGhlUserId);
    const appointments = scoped
      ? allAppointments.filter((a) => a.assignedUserId === tenant.ownerGhlUserId)
      : allAppointments;

    const byDate = new Map<string, OwnerAppointment[]>();
    for (const apt of appointments) {
      const key = toDateKey(Date.parse(apt.startTime));
      const list = byDate.get(key) ?? [];
      list.push(toOwnerAppointment(apt, nowMs));
      byDate.set(key, list);
    }

    const days: CalendarDay[] = [];
    for (let ms = startMs; ms <= endMs; ms += 24 * 60 * 60 * 1000) {
      const date = new Date(ms);
      const key = toDateKey(ms);
      days.push({
        date: key,
        dayOfMonth: date.getDate(),
        isToday: key === toDateKey(nowMs),
        isCurrentMonth: date.getMonth() === now.getMonth(),
        appointments: (byDate.get(key) ?? []).sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime)),
      });
    }

    const upcoming = appointments
      .filter((a) => Date.parse(a.endTime) >= nowMs)
      .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))
      .slice(0, 10)
      .map((a) => toOwnerAppointment(a, nowMs));

    return { ok: true, locationId, scoped, monthLabel, days, upcoming };
  } catch (error) {
    if (error instanceof GhlConfigError || error instanceof LocationNotAuthorizedError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
