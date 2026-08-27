import { describe, expect, it, afterEach, beforeEach } from "vitest";
import {
  DEFAULT_TIME_ZONE,
  endOfDayInZone,
  startOfDayInZone,
  zonedDateKey,
  zonedDateParts,
} from "@/lib/time/zone";

/**
 * Direct tests for the zone primitives.
 *
 * These exist because the first version of `test/owner-calendar.test.ts` had a
 * case named "survives both daylight-saving transitions" that could not fail
 * for a daylight-saving bug: it asserted the grid's cells were unique, 24h
 * apart and self-consistent, all of which are true BY CONSTRUCTION because the
 * cells are UTC-anchored. It restated how the cells are built and never touched
 * the zone-sensitive code at all.
 *
 * The zone-sensitive code is here, so the tests are here, and they are written
 * against the two days a year that are not 24 hours long.
 *
 * TZ is forced to UTC so these run as the container does.
 */

const ORIGINAL_TZ = process.env.TZ;
const HOUR = 60 * 60 * 1000;
const CHICAGO = "America/Chicago";

beforeEach(() => {
  process.env.TZ = "UTC";
});

afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
});

/** Wall-clock reading of an instant in a zone, for assertions a human can check. */
function wall(ms: number, timeZone = CHICAGO): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ms));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}:${g("second")}`;
}

describe("startOfDayInZone", () => {
  it("finds midnight across both offsets", () => {
    // CDT is UTC-5, CST is UTC-6. A fixed offset is wrong for half the year.
    expect(new Date(startOfDayInZone(2026, 6, 15, CHICAGO)).toISOString()).toBe(
      "2026-06-15T05:00:00.000Z",
    );
    expect(new Date(startOfDayInZone(2026, 1, 15, CHICAGO)).toISOString()).toBe(
      "2026-01-15T06:00:00.000Z",
    );
  });

  it("handles a zone where local midnight does not exist", () => {
    // Santiago springs forward at midnight on 2026-09-06: 00:00 never happens,
    // so the correct answer is the instant the day actually begins, 01:00.
    expect(wall(startOfDayInZone(2026, 9, 6, "America/Santiago"), "America/Santiago")).toBe(
      "2026-09-06 01:00:00",
    );
  });
});

describe("endOfDayInZone", () => {
  it("ends the 25-hour day at 23:59:59, not 22:59:59", () => {
    // 2026-11-01 is 25 hours long in Central: the clocks fall back. Computing
    // the end as start + 24h lands an hour SHORT, so a 11:30 PM appointment
    // falls outside "today" with no error anywhere.
    expect(wall(endOfDayInZone(2026, 11, 1, CHICAGO))).toBe("2026-11-01 23:59:59");
  });

  it("does not spill into the next day on the 23-hour day", () => {
    // 2026-03-08 is 23 hours long: the clocks spring forward. Computing the end
    // as start + 24h lands at 00:59 on the 9th, so a call at 00:30 on the 9th
    // is counted under the 8th.
    expect(wall(endOfDayInZone(2026, 3, 8, CHICAGO))).toBe("2026-03-08 23:59:59");
  });

  it("is one millisecond before the next day starts, every day it is asked", () => {
    // The invariant that makes the two cases above fall out rather than be
    // special-cased. Walked across both transitions and a month boundary.
    for (const [y, m, d] of [
      [2026, 11, 1],
      [2026, 3, 8],
      [2026, 6, 15],
      [2026, 12, 31],
      [2026, 2, 28],
    ] as const) {
      expect(endOfDayInZone(y, m, d, CHICAGO) + 1).toBe(startOfDayInZone(y, m, d + 1, CHICAGO));
    }
  });

  it("spans the real length of the day, not an assumed 24 hours", () => {
    const len = (y: number, m: number, d: number) =>
      (endOfDayInZone(y, m, d, CHICAGO) + 1 - startOfDayInZone(y, m, d, CHICAGO)) / HOUR;

    expect(len(2026, 11, 1)).toBe(25);
    expect(len(2026, 3, 8)).toBe(23);
    expect(len(2026, 6, 15)).toBe(24);
  });
});

describe("zonedDateKey and zonedDateParts", () => {
  it("reads the zone's calendar date, not the process's", () => {
    // 01:30Z on the 21st is 8:30 PM Central on the 20th.
    expect(zonedDateKey(Date.parse("2026-08-21T01:30:00.000Z"), CHICAGO)).toBe("2026-08-20");
    expect(zonedDateParts(Date.parse("2026-08-21T01:30:00.000Z"), CHICAGO)).toEqual({
      year: 2026,
      month: 8,
      day: 20,
    });
  });

  it("reports month 1-based, matching the key it prints", () => {
    // Mixing this with Date's 0-based getMonth() is what put the calendar's
    // label a month behind its own grid.
    const parts = zonedDateParts(Date.parse("2026-01-15T12:00:00.000Z"), CHICAGO);
    expect(parts.month).toBe(1);
    expect(zonedDateKey(Date.parse("2026-01-15T12:00:00.000Z"), CHICAGO)).toBe("2026-01-15");
  });

  it("defaults to the zone the formatters default to", () => {
    expect(zonedDateKey(Date.parse("2026-08-21T01:30:00.000Z"))).toBe(
      zonedDateKey(Date.parse("2026-08-21T01:30:00.000Z"), DEFAULT_TIME_ZONE),
    );
  });
});
