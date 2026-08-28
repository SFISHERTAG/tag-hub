import { describe, expect, it, vi, afterEach } from "vitest";
import { formatTime, formatDate } from "@/lib/ghl/format";
import { dayRange } from "@/lib/ghl/appointments";
import { DEFAULT_TIME_ZONE } from "@/lib/time/zone";

/**
 * Story: server-rendered times used the process timezone, which is the
 * developer's zone locally and UTC in Cloud Run because nothing sets TZ in the
 * Dockerfile or on the service. A 9:00 AM Central appointment rendered as
 * "2:00 PM" on the call-prep screen, and `dayRange` made "Today" roll over to
 * tomorrow at about 6pm Central. No error, no clue, just wrong numbers.
 *
 * THESE TESTS FORCE process.env.TZ = "UTC" so they run as the container does.
 * Without that they pass on a US machine whether or not the bug exists, which
 * is exactly how it survived until now.
 */

const ORIGINAL_TZ = process.env.TZ;

afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
  vi.useRealTimers();
});

function asContainer() {
  process.env.TZ = "UTC";
}

describe("formatTime", () => {
  it("renders Central time even when the process runs in UTC", () => {
    asContainer();

    // 14:00Z is 9:00 AM CDT. The bug rendered "2:00 PM".
    expect(formatTime("2026-08-20T14:00:00.000Z")).toBe("9:00 AM");
  });

  it("handles standard time, not just daylight time", () => {
    asContainer();

    // January: Central is UTC-6, so 15:00Z is 9:00 AM CST. A hardcoded offset
    // would be an hour out for half the year.
    expect(formatTime("2026-01-15T15:00:00.000Z")).toBe("9:00 AM");
  });

  it("accepts an explicit zone, so per-tenant is a call-site change", () => {
    asContainer();

    expect(formatTime("2026-08-20T14:00:00.000Z", "America/New_York")).toBe("10:00 AM");
  });

  it("still handles an unparseable value", () => {
    expect(formatTime("not-a-date")).toBe("—");
  });
});

describe("formatDate", () => {
  it("shows the Central date for a late-evening appointment", () => {
    asContainer();

    // 01:30Z on the 21st is 8:30 PM Central on the 20th. Formatting in UTC
    // moves the appointment to the wrong DAY, not just the wrong hour.
    expect(formatDate("2026-08-21T01:30:00.000Z")).toContain("Aug 20");
  });
});

describe("dayRange", () => {
  it("treats a late Central evening as still today", () => {
    asContainer();
    // 01:30Z on the 21st = 8:30 PM Central on the 20th.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T01:30:00.000Z"));

    const { startMs, endMs } = dayRange();

    // The window must be the Central 20th: 05:00Z on the 20th to 04:59:59Z on
    // the 21st. The bug returned the UTC 21st, so a closer at 8:30 PM saw
    // tomorrow's calls under the heading "Today".
    expect(new Date(startMs).toISOString()).toBe("2026-08-20T05:00:00.000Z");
    expect(new Date(endMs).toISOString()).toBe("2026-08-21T04:59:59.999Z");
  });

  it("spans exactly one day, whatever that day is worth", () => {
    asContainer();

    const { startMs, endMs } = dayRange();

    // Not `24h - 1`. That was the old assertion and it encoded the bug: a
    // Central day is 23 or 25 hours twice a year, so the invariant is that the
    // window ends one millisecond before the next one starts.
    expect(endMs + 1).toBe(dayRange(1).startMs);
  });

  it("offsets by whole days", () => {
    asContainer();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T18:00:00.000Z"));

    const today = dayRange(0);
    const tomorrow = dayRange(1);

    expect(tomorrow.startMs - today.startMs).toBe(24 * 60 * 60 * 1000);
  });

  it("uses the same default the formatters do", () => {
    // One constant, so a date and its time can never disagree about the zone.
    expect(DEFAULT_TIME_ZONE).toBe("America/Chicago");
  });
});
