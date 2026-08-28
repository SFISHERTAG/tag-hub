import "server-only";
import { DEFAULT_TIME_ZONE, endOfDayInZone, startOfDayInZone, zonedDateParts } from "../time/zone";
import { ghl } from "./client";

/** GHL's calendar endpoints are pinned to an older API version than the rest. */
const CALENDAR_VERSION = "2021-04-15";

export type AppointmentStatus =
  | "new"
  | "confirmed"
  | "showed"
  | "noshow"
  | "cancelled"
  | "invalid";

export type Calendar = {
  id: string;
  name: string;
  calendarType?: string;
};

export type Appointment = {
  id: string;
  calendarId: string;
  contactId?: string;
  assignedUserId?: string;
  title?: string;
  notes?: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
};

export async function getCalendars(locationId: string): Promise<Calendar[]> {
  const data = await ghl<{ calendars?: Calendar[] }>(locationId, "/calendars/", {
    searchParams: { locationId },
    version: CALENDAR_VERSION,
    revalidate: 300, // calendars change rarely
  });
  return data.calendars ?? [];
}

type RawEvent = Record<string, unknown> & {
  id: string;
  calendarId: string;
  startTime: string;
  endTime: string;
};

/**
 * GHL returns the status under `appointmentStatus`, and also under
 * `appoinmentStatus` — a misspelling present in their own payloads. Reading
 * both means a rename on their side cannot silently blank out the column.
 */
function readStatus(event: RawEvent): AppointmentStatus {
  const value =
    (event.appointmentStatus as string | undefined) ??
    (event.appoinmentStatus as string | undefined) ??
    "confirmed";
  return value as AppointmentStatus;
}

export async function getAppointments(
  locationId: string,
  range: { startMs: number; endMs: number },
): Promise<Appointment[]> {
  const calendars = await getCalendars(locationId);

  const perCalendar = await Promise.all(
    calendars.map(async (calendar) => {
      const data = await ghl<{ events?: RawEvent[] }>(
        locationId,
        "/calendars/events",
        {
          searchParams: {
            locationId,
            calendarId: calendar.id,
            startTime: range.startMs,
            endTime: range.endMs,
          },
          version: CALENDAR_VERSION,
        },
      );

      return (data.events ?? [])
        .filter((event) => !event.deleted)
        .map<Appointment>((event) => ({
          id: event.id,
          calendarId: event.calendarId,
          contactId: event.contactId as string | undefined,
          assignedUserId: event.assignedUserId as string | undefined,
          title: event.title as string | undefined,
          notes: event.notes as string | undefined,
          startTime: event.startTime,
          endTime: event.endTime,
          status: readStatus(event),
        }));
    }),
  );

  return perCalendar
    .flat()
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
}

export async function setAppointmentStatus(
  locationId: string,
  appointmentId: string,
  status: AppointmentStatus,
): Promise<void> {
  await ghl(locationId, `/calendars/events/appointments/${appointmentId}`, {
    method: "PUT",
    version: CALENDAR_VERSION,
    body: { appointmentStatus: status },
  });
}

/**
 * Start and end of a day IN A NAMED TIMEZONE, in epoch milliseconds.
 *
 * `setHours(0,0,0,0)` mutates in the process timezone. That is the developer's
 * zone locally and UTC in Cloud Run, so "today" began at 7pm the previous
 * evening Central: after about 6pm a closer opening /today saw none of that
 * evening's remaining calls and tomorrow's list under the heading "Today".
 *
 * Computed by asking Intl what the wall-clock date is in `timeZone`, then
 * finding the instant that reads as midnight there. Done this way rather than
 * with a fixed offset because Central is UTC-6 or UTC-5 depending on daylight
 * saving, and a hardcoded offset is wrong for half the year.
 */
export function dayRange(
  offsetDays = 0,
  timeZone: string = DEFAULT_TIME_ZONE,
): { startMs: number; endMs: number } {
  const now = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const { year, month, day } = zonedDateParts(now, timeZone);

  // Both ends go through the zone. Deriving the end as start + 24h assumed
  // every day is 24 hours, which is the assumption this function exists to
  // remove: it closed the 25-hour day an hour early and ran the 23-hour day
  // into the next morning.
  return {
    startMs: startOfDayInZone(year, month, day, timeZone),
    endMs: endOfDayInZone(year, month, day, timeZone),
  };
}

export { formatTime } from "./format";
