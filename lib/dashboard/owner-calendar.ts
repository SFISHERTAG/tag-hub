import "server-only";
import {
  DEFAULT_TIME_ZONE,
  endOfDayInZone,
  startOfDayInZone,
  zonedDateKey,
  zonedDateParts,
} from "../time/zone";
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

const DAY_MS = 24 * 60 * 60 * 1000;

function toOwnerAppointment(apt: Appointment, endOfTodayMs: number): OwnerAppointment {
  return {
    id: apt.id,
    title: apt.title || "Untitled call",
    startTime: apt.startTime,
    endTime: apt.endTime,
    status: apt.status,
    isPastOrToday: Date.parse(apt.startTime) <= endOfTodayMs,
  };
}

/** ISO date of a grid cell. Cells are civil dates anchored at UTC midnight. */
function civilKey(cell: Date): string {
  return `${cell.getUTCFullYear()}-${String(cell.getUTCMonth() + 1).padStart(2, "0")}-${String(cell.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Month grid: full calendar weeks covering the current month (Sun–Sat).
 *
 * Two things here were wrong and are load-bearing:
 *
 * 1. **Which month it is** came from `now.getFullYear()`/`getMonth()`, which
 *    read the *process* zone. Nothing sets `TZ` in Cloud Run, so that is UTC
 *    (see `lib/time/zone.ts`), and after 6pm Central the grid drew the wrong
 *    day as today. It now comes from `zonedDateParts`.
 * 2. **The label** was built from a process-local anchor and then formatted in
 *    Central, which reads midnight-UTC-on-the-1st as 7pm on the *previous*
 *    month's last day. The label sat one month behind the grid it labels every
 *    month of the year, and a year behind every January.
 *
 * The grid is a sequence of calendar dates, not instants, so the cells are
 * anchored at UTC midnight where every day is exactly 24h and stepping is
 * exact. Stepping 24h through a named zone skips or repeats a date at each
 * daylight-saving transition. `monthLabel` is formatted from that same civil
 * anchor in UTC for the same reason: it names a month, not a moment.
 */
function monthGrid(
  now: Date,
  timeZone: string,
): { startMs: number; endMs: number; monthLabel: string; cells: Date[]; month: number } {
  const { year, month } = zonedDateParts(now, timeZone);

  const firstUtc = Date.UTC(year, month - 1, 1);
  const lastUtc = Date.UTC(year, month, 0);
  const gridStartUtc = firstUtc - new Date(firstUtc).getUTCDay() * DAY_MS;
  const gridEndUtc = lastUtc + (6 - new Date(lastUtc).getUTCDay()) * DAY_MS;

  const cells: Date[] = [];
  for (let ms = gridStartUtc; ms <= gridEndUtc; ms += DAY_MS) {
    cells.push(new Date(ms));
  }

  const first = cells[0];
  const last = cells[cells.length - 1];

  return {
    startMs: startOfDayInZone(first.getUTCFullYear(), first.getUTCMonth() + 1, first.getUTCDate(), timeZone),
    endMs: endOfDayInZone(last.getUTCFullYear(), last.getUTCMonth() + 1, last.getUTCDate(), timeZone),
    monthLabel: new Date(firstUtc).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    cells,
    month,
  };
}

/**
 * The client owner's own calendar: month grid + upcoming list, scoped to
 * appointments where they're the assigned staff member (see
 * `Tenant.ownerGhlUserId`). If no owner is configured for the tenant, this
 * falls back to the location's whole calendar rather than showing nothing —
 * a client with no admin-configured owner still gets a usable view.
 */
export async function getOwnerCalendar(
  locationId: string,
  timeZone: string = DEFAULT_TIME_ZONE,
): Promise<OwnerCalendarResult> {
  if (!locationId) {
    return { ok: false, message: "No GHL location configured yet." };
  }

  try {
    const tenant = await getTenant(locationId);
    const now = new Date();
    const nowMs = now.getTime();
    const { startMs, endMs, monthLabel, cells, month } = monthGrid(now, timeZone);

    const today = zonedDateParts(now, timeZone);
    const endOfTodayMs = endOfDayInZone(today.year, today.month, today.day, timeZone);

    // Upcoming list can extend past the visible month grid.
    const fetchStart = Math.min(startMs, nowMs);
    const fetchEnd = Math.max(endMs, nowMs + 60 * DAY_MS);

    const allAppointments = await getAppointments(locationId, { startMs: fetchStart, endMs: fetchEnd });
    const scoped = Boolean(tenant.ownerGhlUserId);
    const appointments = scoped
      ? allAppointments.filter((a) => a.assignedUserId === tenant.ownerGhlUserId)
      : allAppointments;

    const byDate = new Map<string, OwnerAppointment[]>();
    for (const apt of appointments) {
      // The day an appointment lands on is the day it reads as in `timeZone`.
      // Bucketing in the process zone put a 7pm Central call on tomorrow.
      const key = zonedDateKey(Date.parse(apt.startTime), timeZone);
      const list = byDate.get(key) ?? [];
      list.push(toOwnerAppointment(apt, endOfTodayMs));
      byDate.set(key, list);
    }

    const todayKey = zonedDateKey(nowMs, timeZone);
    const days: CalendarDay[] = cells.map((cell) => {
      const key = civilKey(cell);
      return {
        date: key,
        dayOfMonth: cell.getUTCDate(),
        isToday: key === todayKey,
        isCurrentMonth: cell.getUTCMonth() + 1 === month,
        appointments: (byDate.get(key) ?? []).sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime)),
      };
    });

    const upcoming = appointments
      .filter((a) => Date.parse(a.endTime) >= nowMs)
      .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))
      .slice(0, 10)
      .map((a) => toOwnerAppointment(a, endOfTodayMs));

    return { ok: true, locationId, scoped, monthLabel, days, upcoming };
  } catch (error) {
    if (error instanceof GhlConfigError || error instanceof LocationNotAuthorizedError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
