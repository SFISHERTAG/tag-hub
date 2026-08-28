import type { Attribution } from './ghl.model';

/**
 * Presentation helpers for GHL data. Pure functions, no injection, no HTTP.
 *
 * These mirror lib/ghl/format.ts, which this side cannot import: that module
 * lives behind the `server-only` boundary's neighbours and belongs to the Next
 * build, not the Angular one. The mirror is deliberately narrow — only what a
 * screen renders — and every function keeps the same rule as the server's:
 * a missing or unparseable timestamp renders as an em-dash, never as "Invalid
 * Date" and never as the epoch.
 */

/**
 * The zone every GHL date and time is expressed in.
 *
 * Mirrors DEFAULT_TIME_ZONE in lib/time/zone.ts, and the reason it is a
 * constant rather than the browser's zone is the same reason it is a constant
 * there: an appointment belongs to the tenant's day, not the viewer's. A CSM in
 * Denver opening a Chicago client's Today must see the same 9:00 AM the closer
 * sees, or the two of them are looking at different appointments.
 *
 * When tenants get their own zone (GHL already carries one on its location
 * object), this becomes a value passed in from the endpoint. Until then a
 * second constant that agrees with the server beats a browser zone that
 * silently disagrees with it.
 */
export const GHL_TIME_ZONE = 'America/Chicago';

const MISSING = '—';
const MS_PER_DAY = 86_400_000;

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatDate(iso: string | null | undefined): string {
  const date = toDate(iso);
  return date === null
    ? MISSING
    : date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: GHL_TIME_ZONE,
      });
}

export function formatTime(iso: string | null | undefined): string {
  const date = toDate(iso);
  return date === null
    ? MISSING
    : date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: GHL_TIME_ZONE,
      });
}

/**
 * "Today", "1 day ago", "12 days ago" — for a Firestore epoch-ms timestamp.
 *
 * **This is a calendar-day question, not an elapsed-duration one**, and the two
 * are not the same measurement. "Today" means *the same date in the tenant's
 * zone*, so the only way to answer it is to ask a named zone which date each
 * instant falls on. The previous implementation divided elapsed milliseconds by
 * 86,400,000, which answers "how many 24-hour blocks fit in the gap" — a
 * different question that agrees with this one only by coincidence.
 *
 * Two ways that coincidence breaks, both verified against the old code:
 *
 * - **Either side of midnight.** 11:30 PM to 12:30 AM is one hour and two
 *   calendar days. The old code returned "Today" for something that happened
 *   yesterday.
 * - **DST, twice a year.** 8 March 2026 is 23 hours long in `GHL_TIME_ZONE`, so
 *   noon-to-noon across it returned "Today" instead of "1 day ago". 1 November
 *   is 25 hours long, so 12:30 AM to 11:30 PM *on that one date* returned
 *   "1 day ago" for two instants on the same day.
 *
 * Contrast `lib/format/time-ago.ts#formatTimeAgo`, which looks like this
 * function and is **correct as written**: it reports elapsed duration ("3 hours
 * ago"), and no timezone can change how long ago something was. Anyone sweeping
 * for relative-time helpers finds both; only this one is a date computation.
 *
 * The zone is `GHL_TIME_ZONE`, the constant this file already applies in
 * `formatDate` and `formatTime`. It was declared eighteen lines above this
 * function and this function did not use it.
 */
export function relativeDays(markedAt: number, now: number = Date.now()): string {
  if (!isDateable(markedAt) || !isDateable(now)) return MISSING;
  const days = civilDayIndex(now) - civilDayIndex(markedAt);
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

/** Constructed once: `Intl.DateTimeFormat` is expensive and this runs per row. */
const CIVIL_DAY_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: GHL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * The calendar date an instant falls on in `GHL_TIME_ZONE`, as a day number
 * that can be subtracted.
 *
 * The parts are re-anchored through `Date.UTC` on purpose: UTC has no DST, so
 * dividing by `MS_PER_DAY` there is exact. Doing the same arithmetic in a zone
 * that observes DST is what this function exists to avoid.
 */
/**
 * Whether an epoch-ms value can become a `Date` at all.
 *
 * **`Number.isFinite` is not enough, and this guard replaced it.** ECMA-262 caps
 * a Date at +/-8,640,000,000,000,000 ms. `1e16` is finite, passes
 * `Number.isFinite`, and makes `Intl.DateTimeFormat.formatToParts` throw
 * `RangeError: Invalid time value`.
 *
 * That was a regression I introduced, not a pre-existing hole. The previous
 * implementation divided elapsed milliseconds and returned a number, so no
 * input could make it throw. This one formats, so out-of-range input can — and
 * `relativeDays` is called per row from a template
 * (`follow-up/follow-up-panel.ts:151`), where a throw during change detection
 * takes out the whole widget rather than one cell.
 *
 * One predicate covers every bad case: `new Date(x).getTime()` is `NaN` for
 * `NaN`, for `Infinity`, and for anything past the range cap.
 */
function isDateable(ms: number): boolean {
  return !Number.isNaN(new Date(ms).getTime());
}

function civilDayIndex(ms: number): number {
  let year = 0;
  let month = 0;
  let day = 0;
  for (const part of CIVIL_DAY_FORMAT.formatToParts(new Date(ms))) {
    if (part.type === 'year') year = Number(part.value);
    else if (part.type === 'month') month = Number(part.value);
    else if (part.type === 'day') day = Number(part.value);
  }
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

export function plural(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

/** The card badge. Null days means GHL sent no timestamp, which is not "0d". */
export function stageAgeLabel(daysInStage: number | null): string | null {
  return daysInStage === null ? null : `${daysInStage}d in stage`;
}

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * First and last touch, read off a contact that has not been normalized.
 *
 * DUPLICATES two lines of lib/ghl/format.ts, and it should not have to. The
 * contact DETAIL endpoint already normalizes attribution into
 * `firstTouch`/`lastTouch`, so the contact screen never calls these. The `/prep`
 * endpoint returns the raw contact, and the call-prep panel showed attribution
 * in the Next app, so the choice was between duplicating this shape knowledge
 * or dropping a panel a closer reads before every call.
 *
 * The right fix is three lines in `app/api/ghl/.../prep/route.ts` — return
 * `firstTouch`/`lastTouch` the way the detail route does — after which both
 * functions below can be deleted. Flagged in the story report rather than done
 * here, because that file belongs to another agent this round.
 *
 * First and last are kept apart deliberately: one names the ad that found the
 * lead, the other the ad that brought them back. Collapsing them misreads which
 * creative is doing the work.
 */
export function firstTouchOf(contact: {
  readonly attributionSource?: Attribution;
  readonly attributions?: readonly Attribution[];
}): Attribution | null {
  return contact.attributionSource ?? contact.attributions?.[0] ?? null;
}

export function lastTouchOf(contact: {
  readonly lastAttributionSource?: Attribution;
}): Attribution | null {
  return contact.lastAttributionSource ?? null;
}

/** One line of attribution, the way the prep panel showed it: the ad if there
 * is one, then the campaign. Null when neither is on file, so the caller can
 * say "no attribution" rather than render an empty row. */
export function attributionLine(attribution: Attribution | null): string | null {
  if (attribution === null) return null;
  const ad = attribution.utmAdId ? `Ad: ${attribution.utmAdId}` : null;
  const campaign = attribution.utmCampaign ?? attribution.campaign ?? null;
  const parts = [ad, campaign].filter((part): part is string => part !== null && part !== '');
  return parts.length === 0 ? null : parts.join(' / ');
}
