import {
  attributionLine,
  firstTouchOf,
  formatDate,
  formatMoney,
  formatTime,
  lastTouchOf,
  plural,
  relativeDays,
  stageAgeLabel,
} from './ghl-format';

/**
 * Story: two failure modes, both of which shipped in the Next app.
 *
 * A time rendered in the process timezone was five or six hours out with no
 * error to notice — so every date and time here is pinned to the tenant zone
 * rather than the runner's, and these tests fail if that is ever dropped.
 *
 * And a missing value rendered as "Invalid Date" or as the epoch. On an
 * operations screen both read as data. Missing renders as an em-dash, always.
 */
describe('ghl-format', () => {
  describe('money', () => {
    it('renders whole dollars', () => {
      expect(formatMoney(1200)).toBe('$1,200');
    });

    it('treats a missing amount as zero rather than NaN', () => {
      expect(formatMoney(Number.NaN)).toBe('$0');
    });
  });

  describe('dates and times', () => {
    // 2026-03-02T01:30:00Z is 7:30 PM on March 1st in America/Chicago. A
    // formatter using the runner's zone (UTC in CI) reports the 2nd, which is
    // the exact bug: an evening appointment lands on the wrong day.
    const eveningBefore = '2026-03-02T01:30:00.000Z';

    it('renders a date in the tenant zone, not the runner zone', () => {
      expect(formatDate(eveningBefore)).toBe('Mar 1, 2026');
    });

    it('renders a time in the tenant zone, not the runner zone', () => {
      expect(formatTime(eveningBefore)).toBe('7:30 PM');
    });

    it('renders a missing timestamp as an em-dash', () => {
      expect(formatDate(undefined)).toBe('—');
      expect(formatTime(null)).toBe('—');
    });

    it('renders an unparseable timestamp as an em-dash, never "Invalid Date"', () => {
      expect(formatDate('not-a-date')).toBe('—');
      expect(formatTime('not-a-date')).toBe('—');
    });
  });

  describe('relativeDays', () => {
    const now = Date.parse('2026-03-10T12:00:00.000Z');

    it('calls the same day today', () => {
      expect(relativeDays(now - 3_600_000, now)).toBe('Today');
    });

    it('singularises one day', () => {
      expect(relativeDays(now - 86_400_000, now)).toBe('1 day ago');
    });

    it('counts whole days beyond that', () => {
      expect(relativeDays(now - 12 * 86_400_000, now)).toBe('12 days ago');
    });

    it('never reports a future timestamp as negative days', () => {
      expect(relativeDays(now + 86_400_000, now)).toBe('Today');
    });

    /**
     * The four cases above cannot fail for the defect these three cover.
     * Every one of them sits on an exact multiple of 86,400,000, where
     * "elapsed / 24h" and "difference between calendar dates" agree by
     * coincidence, so all four pass against the broken implementation too.
     * That is worth stating rather than leaving for the next reader to
     * discover: a test that cannot fail is not coverage.
     *
     * These three are written as absolute UTC instants and assert against
     * GHL_TIME_ZONE calendar days, so they do not depend on the runner's own
     * zone — which is unpinned, and would otherwise decide the result. Each
     * one was confirmed to FAIL against the previous implementation before
     * being committed; the expected value is the corrected answer, not a
     * transcript of what the code currently returns.
     */
    it('counts the calendar day, not 24-hour blocks, across midnight', () => {
      // 11:30 PM -> 12:30 AM in America/Chicago. One hour, two dates.
      const marked = Date.parse('2026-03-10T04:30:00.000Z');
      const at = Date.parse('2026-03-10T05:30:00.000Z');
      expect(relativeDays(marked, at)).toBe('1 day ago');
    });

    it('handles the spring-forward date being 23 hours long', () => {
      // Noon to noon across 8 March 2026, when DST starts. 23 hours elapsed,
      // one calendar day apart. "elapsed / 24h" floors this to 0.
      const marked = Date.parse('2026-03-07T18:00:00.000Z');
      const at = Date.parse('2026-03-08T17:00:00.000Z');
      expect(relativeDays(marked, at)).toBe('1 day ago');
    });

    it('handles the fall-back date being 25 hours long', () => {
      // 12:30 AM to 11:30 PM on 1 November 2026, when DST ends. Both instants
      // are the same date, but 24 hours apart, so "elapsed / 24h" reports a
      // day that did not pass.
      const marked = Date.parse('2026-11-01T05:30:00.000Z');
      const at = Date.parse('2026-11-02T05:30:00.000Z');
      expect(relativeDays(marked, at)).toBe('Today');
    });

    it('returns the em-dash for a non-finite timestamp', () => {
      expect(relativeDays(Number.NaN, now)).toBe('—');
    });

    /**
     * The NaN case above tests the guard that already worked. This one tests
     * the hole: ECMA-262 caps a Date at +/-8.64e15 ms, so 1e16 is finite,
     * passes `Number.isFinite`, and made `Intl.DateTimeFormat` throw
     * `RangeError` rather than return a string. Confirmed to throw against the
     * `Number.isFinite` guard before this was committed.
     */
    it('returns the em-dash for a timestamp past the Date range', () => {
      expect(relativeDays(1e16, now)).toBe('—');
      expect(relativeDays(-1e16, now)).toBe('—');
    });

    /** The boundary itself is a real Date, so the guard must not reject it. */
    it('still handles the largest representable timestamp', () => {
      expect(relativeDays(8_640_000_000_000_000, now)).toBe('Today');
    });
  });

  describe('stageAgeLabel', () => {
    it('keeps "no timestamp" distinct from "zero days"', () => {
      // GHL sending nothing is not the same fact as a card that moved today,
      // and a badge reading "0d in stage" would assert the second.
      expect(stageAgeLabel(null)).toBeNull();
      expect(stageAgeLabel(0)).toBe('0d in stage');
    });
  });

  describe('plural', () => {
    it('agrees with its count', () => {
      expect(plural(1, 'deal')).toBe('1 deal');
      expect(plural(0, 'deal')).toBe('0 deals');
      expect(plural(4, 'contact')).toBe('4 contacts');
    });
  });

  describe('attribution', () => {
    it('prefers the normalized first-touch field over the list array', () => {
      const contact = {
        attributionSource: { utmAdId: 'ad-1' },
        attributions: [{ utmAdId: 'ad-list' }],
      };
      expect(firstTouchOf(contact)?.utmAdId).toBe('ad-1');
    });

    it('falls back to the first entry of the list shape', () => {
      expect(firstTouchOf({ attributions: [{ utmAdId: 'ad-list' }] })?.utmAdId).toBe('ad-list');
    });

    it('reports no last touch rather than reusing the first', () => {
      // First and last touch answer different questions — the ad that found
      // them versus the ad that brought them back. Substituting one for the
      // other misattributes revenue to the wrong creative.
      expect(lastTouchOf({})).toBeNull();
    });

    it('renders the ad and campaign together', () => {
      expect(attributionLine({ utmAdId: 'ad-1', utmCampaign: 'spring' })).toBe('Ad: ad-1 / spring');
    });

    it('falls back to the alternate campaign field name', () => {
      expect(attributionLine({ campaign: 'spring' })).toBe('spring');
    });

    it('returns null when there is nothing on file', () => {
      expect(attributionLine({})).toBeNull();
      expect(attributionLine(null)).toBeNull();
    });
  });
});
