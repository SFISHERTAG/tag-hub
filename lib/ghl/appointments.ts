import "server-only";
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

/** Start and end of the local day, in epoch milliseconds. */
export function dayRange(offsetDays = 0): { startMs: number; endMs: number } {
  const start = new Date();
  start.setDate(start.getDate() + offsetDays);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
}
