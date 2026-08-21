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

/** "Today", "1 day ago", "12 days ago" — for a Firestore epoch-ms timestamp. */
export function relativeDays(markedAt: number, now: number = Date.now()): string {
  if (!Number.isFinite(markedAt)) return MISSING;
  const days = Math.floor((now - markedAt) / MS_PER_DAY);
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
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
