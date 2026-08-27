import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * The owner calendar did its day maths in the PROCESS timezone — `setHours`,
 * `getFullYear`, `getMonth`, `getDate` — while formatting its month label in
 * America/Chicago. Nothing sets `TZ` in Cloud Run, so the process is UTC (see
 * `lib/time/zone.ts`), and the two disagreed:
 *
 *   - the label read one month behind the grid it labels, every month of the
 *     year, and a year behind every January;
 *   - a 7pm Central appointment bucketed onto the following day;
 *   - after 6pm Central the grid drew the wrong cell as today.
 *
 * THESE TESTS FORCE process.env.TZ = "UTC" so they run as the container does.
 * Without that they pass on a US machine whether or not the bug exists, which
 * is how this survived alongside the formatters that were already fixed.
 */

const getAppointments = vi.fn(async () => [] as unknown[]);
const getTenant = vi.fn(async () => ({ ownerGhlUserId: undefined }));

vi.mock("@/lib/ghl/appointments", () => ({
  getAppointments: (...args: unknown[]) => getAppointments(...(args as [])),
}));
vi.mock("@/lib/ghl/tenants", () => ({
  getTenant: (...args: unknown[]) => getTenant(...(args as [])),
}));
vi.mock("@/lib/ghl/tokens", () => ({
  GhlConfigError: class GhlConfigError extends Error {},
  LocationNotAuthorizedError: class LocationNotAuthorizedError extends Error {},
}));

const { getOwnerCalendar } = await import("@/lib/dashboard/owner-calendar");

const ORIGINAL_TZ = process.env.TZ;
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  process.env.TZ = "UTC";
  getAppointments.mockResolvedValue([]);
  getTenant.mockResolvedValue({ ownerGhlUserId: undefined });
});

afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
  vi.useRealTimers();
  vi.clearAllMocks();
});

function at(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

async function calendar(timeZone?: string) {
  const result = await getOwnerCalendar("loc-1", timeZone);
  if (!result.ok) throw new Error(`expected ok, got: ${result.message}`);
  return result;
}

describe("monthLabel", () => {
  it("names the month the grid actually draws, in all twelve", async () => {
    // The bug: the anchor was midnight UTC on the 1st, formatted in Central,
    // which reads as 7pm on the LAST day of the previous month. Wrong in 12
    // of 12, so a single-month test would not have been luck, it would have
    // been the only possible result.
    const expected = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];

    for (let m = 0; m < 12; m++) {
      at(new Date(Date.UTC(2026, m, 15, 12)).toISOString());
      const { monthLabel, days } = await calendar();

      expect(monthLabel).toBe(`${expected[m]} 2026`);

      // And the label must agree with the grid rather than merely be plausible:
      // every in-month cell belongs to the month the label names.
      const inMonth = days.filter((d) => d.isCurrentMonth);
      for (const day of inMonth) {
        expect(day.date.slice(0, 7)).toBe(`2026-${String(m + 1).padStart(2, "0")}`);
      }
      vi.useRealTimers();
    }
  });

  it("does not slip a year in January", async () => {
    // Midnight UTC on 2026-01-01 is 6pm Central on 2025-12-31. The bug
    // rendered "December 2025" over a grid of January 2026.
    at("2026-01-15T12:00:00.000Z");

    expect((await calendar()).monthLabel).toBe("January 2026");
  });

  it("labels the Central month, not the UTC one, at a boundary", async () => {
    // 2026-09-01T02:00Z is 9pm Central on August 31. The month is still August
    // for the person looking at it.
    at("2026-09-01T02:00:00.000Z");

    expect((await calendar()).monthLabel).toBe("August 2026");
  });
});

describe("day bucketing", () => {
  it("puts a late Central evening appointment on the Central day", async () => {
    // 01:30Z on the 21st is 8:30 PM Central on the 20th. Bucketing in the
    // process zone moved it to the 21st — the wrong cell in the grid.
    at("2026-08-20T18:00:00.000Z");
    getAppointments.mockResolvedValue([
      {
        id: "a1",
        title: "Evening call",
        startTime: "2026-08-21T01:30:00.000Z",
        endTime: "2026-08-21T02:30:00.000Z",
        status: "confirmed",
        assignedUserId: "u1",
      },
    ]);

    const { days } = await calendar();
    const twentieth = days.find((d) => d.date === "2026-08-20");
    const twentyfirst = days.find((d) => d.date === "2026-08-21");

    expect(twentieth?.appointments.map((a) => a.id)).toEqual(["a1"]);
    expect(twentyfirst?.appointments).toEqual([]);
  });

  it("marks the Central day as today after 6pm Central", async () => {
    // 01:30Z on the 21st = 8:30 PM Central on the 20th.
    at("2026-08-21T01:30:00.000Z");

    const { days } = await calendar();
    const today = days.filter((d) => d.isToday);

    expect(today).toHaveLength(1);
    expect(today[0].date).toBe("2026-08-20");
  });
});

describe("the grid itself", () => {
  it("is whole Sun–Sat weeks with no gap or repeat", async () => {
    at("2026-08-15T12:00:00.000Z");

    const { days } = await calendar();

    expect(days.length % 7).toBe(0);
    expect(new Date(`${days[0].date}T00:00:00Z`).getUTCDay()).toBe(0);
    expect(new Date(`${days[days.length - 1].date}T00:00:00Z`).getUTCDay()).toBe(6);
    expect(new Set(days.map((d) => d.date)).size).toBe(days.length);
  });

  it("stays a contiguous civil sequence in a month containing a transition", async () => {
    // NAMED HONESTLY: these properties are true BY CONSTRUCTION, because the
    // cells are UTC-anchored and UTC has no daylight saving. This is a guard
    // against a future refactor that "simplifies" the civil anchor into zone
    // stepping — which would repeat 1 November and skip 8 March — and it is NOT
    // a test of daylight-saving behaviour. An earlier version of this case was
    // named "survives both daylight-saving transitions" and could not fail for
    // a daylight-saving bug, which is worse than no test.
    //
    // The zone-sensitive code is `lib/time/zone.ts`. It is tested in
    // `test/zone.test.ts`, against the two days a year that are not 24h long.
    for (const iso of ["2026-03-15T12:00:00.000Z", "2026-11-15T12:00:00.000Z"]) {
      at(iso);
      const { days } = await calendar();

      expect(new Set(days.map((d) => d.date)).size).toBe(days.length);
      for (let i = 1; i < days.length; i++) {
        const prev = Date.parse(`${days[i - 1].date}T00:00:00Z`);
        const curr = Date.parse(`${days[i].date}T00:00:00Z`);
        expect(curr - prev).toBe(DAY_MS);
      }
      vi.useRealTimers();
    }
  });

  it("buckets across a daylight-saving transition by the zone, and can fail", async () => {
    // This one IS zone-sensitive, and no single fixed offset can pass it.
    // 2026-11-01 is the fall-back: Central is UTC-5 before 07:00Z and UTC-6
    // after. These two instants are exactly 24h apart and BOTH fall on the
    // Central 1st — the first at 00:30, the second at 23:30 — because the day
    // is 25 hours long.
    //
    //   assume UTC-5 throughout → the second lands on 2026-11-02
    //   assume UTC-6 throughout → the first lands on 2026-10-31
    //
    // Only asking the zone at each instant puts them both on the 1st.
    at("2026-11-01T18:00:00.000Z");
    getAppointments.mockResolvedValue([
      {
        id: "before",
        title: "Just after midnight, CDT",
        startTime: "2026-11-01T05:30:00.000Z",
        endTime: "2026-11-01T06:30:00.000Z",
        status: "confirmed",
      },
      {
        id: "after",
        title: "Just before midnight, CST",
        startTime: "2026-11-02T05:30:00.000Z",
        endTime: "2026-11-02T06:30:00.000Z",
        status: "confirmed",
      },
    ]);

    const { days } = await calendar();
    const on = (date: string) => days.find((d) => d.date === date)?.appointments.map((a) => a.id);

    expect(on("2026-11-01")).toEqual(["before", "after"]);
    expect(on("2026-11-02")).toEqual([]);
    // The grid starts on Sunday 2026-11-01, so a misbucketed "before" would
    // fall outside it entirely and simply vanish rather than move.
    expect(days[0].date).toBe("2026-11-01");
  });
});

describe("the zone is a parameter", () => {
  it("accepts an explicit zone, so per-tenant is a call-site change", async () => {
    // 2026-09-01T02:00Z is 9pm Aug 31 in Chicago but already September in
    // London. Same instant, different month, and the caller decides.
    at("2026-09-01T02:00:00.000Z");

    expect((await calendar("America/Chicago")).monthLabel).toBe("August 2026");
    expect((await calendar("Europe/London")).monthLabel).toBe("September 2026");
  });
});
