/**
 * The timezone every server-rendered date and time is expressed in.
 *
 * This exists because the code that formats times had no timezone at all, so it
 * used the process's own. On a developer's machine that is US Central and
 * everything looked right. In Cloud Run nothing sets TZ, so Node defaults to
 * UTC: a 9:00 AM Central appointment rendered as "2:00 PM" on the call-prep
 * screen, with no error and no clue, which is the worst possible shape for that
 * particular bug.
 *
 * It is a constant rather than a tenant field ON PURPOSE, and the honesty
 * matters more than the flexibility. There is no timezone anywhere in this
 * system today: not on `Tenant`, not on `LocationConfig`, and not in the live
 * `clients` documents. Inventing a field nothing populates would swap a visible
 * wrong answer for an invisible one that silently falls back to a default
 * anyway.
 *
 * When tenants genuinely need their own, GoHighLevel already carries a timezone
 * on its location object and is the system of record for locations, so the
 * change is to read it there and pass it in. Every function below takes the
 * zone as an argument for exactly that reason: making it per-tenant later means
 * changing call sites, not rewriting formatting.
 */
export const DEFAULT_TIME_ZONE = "America/Chicago";

/** The wall-clock time in `timeZone`, formatted so Date.parse reads it as UTC. */
function zonedIsoString(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`;
}

/**
 * The calendar date an instant falls on, as seen in `timeZone`.
 *
 * `month` is 1-based, matching the ISO date it prints, not `Date`'s 0-based
 * `getMonth()`. Mixing the two is how a month label ends up one behind.
 */
export function zonedDateParts(
  instant: Date | number,
  timeZone: string = DEFAULT_TIME_ZONE,
): { year: number; month: number; day: number } {
  const [{ value: month }, , { value: day }, , { value: year }] = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant instanceof Date ? instant : new Date(instant));

  return { year: Number(year), month: Number(month), day: Number(day) };
}

/** The ISO calendar date (`YYYY-MM-DD`) an instant falls on in `timeZone`. */
export function zonedDateKey(
  instant: Date | number,
  timeZone: string = DEFAULT_TIME_ZONE,
): string {
  const { year, month, day } = zonedDateParts(instant, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * The instant midnight begins on a given calendar date in `timeZone`.
 *
 * Guessed as UTC midnight, then corrected by the zone's offset at that moment.
 * Done this way rather than with a fixed offset because Central is UTC-6 or
 * UTC-5 depending on daylight saving, and a hardcoded offset is wrong for half
 * the year. `month` is 1-based.
 */
export function startOfDayInZone(
  year: number,
  month: number,
  day: number,
  timeZone: string = DEFAULT_TIME_ZONE,
): number {
  const guess = Date.UTC(year, month - 1, day);
  const offsetMs = guess - Date.parse(zonedIsoString(new Date(guess), timeZone));
  return guess + offsetMs;
}

/**
 * Last millisecond of a calendar date in `timeZone`.
 *
 * Derived from when the NEXT day starts, not from a 24-hour assumption, which
 * is wrong on the two days a year this module exists for: 2026-11-01 in Central
 * is 25 hours long and 2026-03-08 is 23. Adding a fixed day ended the long one
 * an hour early, hiding an 11:30 PM call from "today" with no error, and ran the
 * short one into 00:59 the following morning.
 *
 * `Date.UTC` normalises the day overflow inside `startOfDayInZone`, so the last
 * day of a month and 31 December need no special case.
 */
export function endOfDayInZone(
  year: number,
  month: number,
  day: number,
  timeZone: string = DEFAULT_TIME_ZONE,
): number {
  return startOfDayInZone(year, month, day + 1, timeZone) - 1;
}
