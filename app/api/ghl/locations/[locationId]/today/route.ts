import "server-only";
import type { NextRequest } from "next/server";
import {
  dayRange,
  getAppointments,
  getCalendars,
  type Appointment,
  type Calendar,
} from "@/lib/ghl/appointments";
import { getClientHealth } from "@/lib/ghl/portfolio";
import { withErrorHandling } from "@/lib/api/errorInterceptor";
import { gateLocation } from "@/app/api/ghl/_lib/gate";
import { badRequest, ghlJson } from "@/app/api/ghl/_lib/respond";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/ghl/locations/[locationId]/today";

const DAYS = {
  yesterday: { offset: -1, label: "Yesterday" },
  today: { offset: 0, label: "Today" },
  tomorrow: { offset: 1, label: "Tomorrow" },
} as const;

type DayKey = keyof typeof DAYS;
const DAY_KEYS = Object.keys(DAYS) as DayKey[];

/** An appointment already joined to its calendar's name, so the client does
 * not have to hold a second list and do the lookup itself. */
export type TodayAppointment = Appointment & { calendarName: string };

export type TodaySummary = {
  total: number;
  /** Appointments whose outcome the closer has already marked showed or noshow. */
  marked: number;
  /**
   * Show rate as a whole percent, or null when the outcome store could not be
   * read. Null is not zero: "we could not load it" and "nobody showed" are
   * different answers and the screen must be able to tell them apart.
   *
   * Computed by `getClientHealth`, not here. That function already carries the
   * rule that keeps this bounded — a pre-call DQ leaves the denominator, an
   * on-call DQ stays in it but never counts as a show, and an appointment with
   * no outcome record stays in the denominator — so showed can never exceed
   * the denominator and the rate can never exceed 100%. A second
   * implementation on this side is exactly how that guarantee was lost before.
   */
  showRatePct: number | null;
  dqBreakdown: { preCall: number; onCall: number } | null;
  /** True when the outcome store failed. showRatePct and dqBreakdown are null for that reason. */
  outcomesUnavailable: boolean;
};

export type TodayResponse = {
  day: DayKey;
  label: string;
  range: { startMs: number; endMs: number };
  calendars: Calendar[];
  appointments: TodayAppointment[];
  summary: TodaySummary;
};

/**
 * GET /api/ghl/locations/[locationId]/today?day=today
 *
 * The closer's day. `dayRange` resolves the window in the tenant's named time
 * zone rather than the process one — in Cloud Run the process zone is UTC, so
 * a naive "today" started at 7pm the previous evening Central and hid that
 * evening's remaining calls.
 *
 * The follow-up queue is deliberately NOT bundled in here. It has its own
 * endpoint (`/follow-up`) so the today screen and the dedicated follow-up
 * screen resolve the same queue through the same code path — the two disagreeing
 * about the same contact is the defect that shared module exists to prevent.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> },
) {
  const { locationId } = await params;
  const gate = await gateLocation(locationId, CONTEXT);
  if (!gate.ok) return gate.response;

  const requested = request.nextUrl.searchParams.get("day");
  if (requested !== null && !DAY_KEYS.includes(requested as DayKey)) {
    return badRequest(CONTEXT, `day must be one of: ${DAY_KEYS.join(", ")}.`);
  }
  const day: DayKey = (requested as DayKey | null) ?? "today";

  return ghlJson<TodayResponse>(CONTEXT, async () => {
    const range = dayRange(DAYS[day].offset);
    const [appointments, calendars] = await Promise.all([
      getAppointments(locationId, range),
      getCalendars(locationId),
    ]);

    const calendarNames = new Map(calendars.map((calendar) => [calendar.id, calendar.name]));
    const joined: TodayAppointment[] = appointments.map((appointment) => ({
      ...appointment,
      calendarName: calendarNames.get(appointment.calendarId) ?? "Calendar",
    }));

    const marked = appointments.filter(
      (appointment) => appointment.status === "showed" || appointment.status === "noshow",
    ).length;

    // Firestore, not GHL. A hiccup here must not take the appointment list
    // down with it, so it is isolated — but reported rather than swallowed.
    const health = await withErrorHandling(`getClientHealth(${locationId})`, () =>
      getClientHealth(
        locationId,
        appointments.map((appointment) => appointment.id),
      ),
    );

    const summary: TodaySummary = {
      total: appointments.length,
      marked,
      showRatePct: health.data?.showRate ?? null,
      dqBreakdown: health.data?.dqBreakdown ?? null,
      outcomesUnavailable: health.error !== null,
    };

    return { day, label: DAYS[day].label, range, calendars, appointments: joined, summary };
  });
}
