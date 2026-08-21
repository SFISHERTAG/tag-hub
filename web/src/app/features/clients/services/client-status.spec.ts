import {
  BUCKET_ORDER,
  STATUS_ORDER,
  bucketDisplay,
  checkInLabel,
  escalationSortRank,
  needsAttention,
  scoreTone,
  statusDisplay,
  statusLabel,
} from './client-status';
import type { ClientStatus } from './client.model';

/**
 * Story: these are the display rules every client surface shares, so the thing
 * worth defending is that they agree with each other and with the server.
 *
 * The specific failure this guards against: `scoreTone` deciding a rollup
 * average of 74 is "healthy" while `statusDisplay` calls an individual score of
 * 74 "at risk". Two different opinions about the same number, on the same
 * screen, is how a director and their CSM end up disagreeing about which book
 * is in trouble.
 */

const ALL: readonly ClientStatus[] = ['excellent', 'healthy', 'at-risk', 'critical', 'alert'];

describe('client-status', () => {
  it('returns a tone, never a colour', () => {
    for (const status of ALL) {
      const display = statusDisplay(status);
      expect(['positive', 'caution', 'negative']).toContain(display.tone);
      // The reference implementation returned Tailwind class names from this
      // function, which is how a colour decision escapes the theme.
      expect(display.tone).not.toMatch(/^(text|bg)-/);
    }
  });

  it('labels every status without falling through to the raw key', () => {
    expect(statusLabel('at-risk')).toBe('At risk');
    for (const status of ALL) {
      expect(statusLabel(status).length).toBeGreaterThan(0);
      expect(statusLabel(status)).not.toBe(status);
    }
  });

  it('flags exactly the three statuses that mean act now', () => {
    expect(ALL.filter(needsAttention)).toEqual(['at-risk', 'critical', 'alert']);
  });

  it('agrees with the score thresholds the individual statuses use', () => {
    // health-scoring.ts: >=75 healthy, >=60 at-risk, below that critical/alert.
    expect(scoreTone(90)).toBe('positive');
    expect(scoreTone(75)).toBe('positive');
    expect(scoreTone(74)).toBe('caution');
    expect(scoreTone(60)).toBe('caution');
    expect(scoreTone(59)).toBe('negative');
    expect(scoreTone(0)).toBe('negative');
  });

  it('orders kanban columns and escalation buckets worst first', () => {
    expect(STATUS_ORDER[0]).toBe('alert');
    expect(STATUS_ORDER.at(-1)).toBe('excellent');
    expect(BUCKET_ORDER[0]).toBe('at-risk');
  });

  it('covers every status and bucket, so nothing renders as undefined', () => {
    expect(new Set(STATUS_ORDER)).toEqual(new Set(ALL));
    for (const bucket of BUCKET_ORDER) {
      expect(bucketDisplay(bucket).title.length).toBeGreaterThan(0);
    }
  });

  it('ranks the escalation sort worst first', () => {
    const ranked = [...ALL].sort((a, b) => escalationSortRank(a) - escalationSortRank(b));
    expect(ranked).toEqual(['critical', 'alert', 'at-risk', 'healthy', 'excellent']);
  });

  describe('checkInLabel', () => {
    it('says a missing check-in is a fresh onboarding, not zero days', () => {
      // Rendering null as "0 days ago" would put a brand new client at the top
      // of a most-overdue list.
      expect(checkInLabel(null)).toContain('No check-in yet');
      expect(checkInLabel(null)).not.toContain('0');
    });

    it('reads naturally at the boundaries', () => {
      expect(checkInLabel(0)).toBe('Checked in today');
      expect(checkInLabel(1)).toBe('Last check-in 1 day ago');
      expect(checkInLabel(12)).toBe('Last check-in 12 days ago');
    });
  });
});
