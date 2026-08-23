import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Story 11.6 — course progress moves from Firestore to Postgres.
 *
 * The point of these tests is the shape of the writes, not the SQL text.
 * Progress is a per-checkbox upsert keyed by the five-part path the Firestore
 * document tree used, and the read has to return the same `section/subsection/
 * checkbox` key the UI already indexes by, or the port silently loses ticks.
 */

const query = vi.fn();
vi.mock("@/lib/postgres", () => ({
  pool: { query: (...args: unknown[]) => query(...args) },
}));

const {
  getUserCheckboxProgress,
  updateCheckboxProgress,
  getCourseProgress,
  getCourseCompletionRates,
} = await import("./progress");

beforeEach(() => query.mockReset());

describe("getUserCheckboxProgress", () => {
  it("returns null when the checkbox has never been touched", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await getUserCheckboxProgress("u1", "c1", "s1", "ss1", "cb1")).toBeNull();
  });

  it("returns completion state and a millisecond timestamp", async () => {
    const when = new Date("2026-08-23T04:00:00.000Z");
    query.mockResolvedValueOnce({ rows: [{ completed: true, completed_at: when }] });
    expect(await getUserCheckboxProgress("u1", "c1", "s1", "ss1", "cb1")).toEqual({
      completed: true,
      completedAt: when.getTime(),
    });
  });

  it("leaves completedAt undefined when the row is not complete", async () => {
    query.mockResolvedValueOnce({ rows: [{ completed: false, completed_at: null }] });
    expect(await getUserCheckboxProgress("u1", "c1", "s1", "ss1", "cb1")).toEqual({
      completed: false,
      completedAt: undefined,
    });
  });
});

describe("updateCheckboxProgress", () => {
  it("upserts rather than inserting, so a re-tick is not a duplicate key", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await updateCheckboxProgress("u1", "c1", "s1", "ss1", "cb1", true);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/ON CONFLICT/i);
    expect(params.slice(0, 5)).toEqual(["u1", "c1", "s1", "ss1", "cb1"]);
  });

  it("clears completed_at when a checkbox is un-ticked", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await updateCheckboxProgress("u1", "c1", "s1", "ss1", "cb1", false);
    const [, params] = query.mock.calls[0] as [string, unknown[]];
    // completed=false, so the timestamp argument must be null and not "now".
    expect(params[5]).toBe(false);
    expect(params[6]).toBeNull();
  });
});

describe("getCourseProgress", () => {
  it("keys the map the same way the Firestore version did", async () => {
    query.mockResolvedValueOnce({
      rows: [
        { section_id: "s1", subsection_id: "ss1", checkbox_id: "cb1", completed: true, completed_at: null },
        { section_id: "s2", subsection_id: "ss2", checkbox_id: "cb2", completed: false, completed_at: null },
      ],
    });
    const progress = await getCourseProgress("u1", "c1");
    expect([...progress.keys()]).toEqual(["s1/ss1/cb1", "s2/ss2/cb2"]);
    expect(progress.get("s1/ss1/cb1")?.completed).toBe(true);
  });

  it("is one query, not a walk down four levels", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await getCourseProgress("u1", "c1");
    expect(query).toHaveBeenCalledTimes(1);
  });
});

/**
 * AC5. Option A was chosen over keeping Firestore specifically because
 * aggregate reporting was wanted, so the aggregate has to exist rather than be
 * left as a follow-up.
 */
describe("getCourseCompletionRates", () => {
  it("aggregates in SQL, not in JS", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await getCourseCompletionRates("c1");
    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toMatch(/count\(/i);
    expect(sql).toMatch(/group by/i);
  });

  it("returns a completion rate per user", async () => {
    query.mockResolvedValueOnce({
      rows: [
        { uid: "u1", completed_count: "3", total_count: "4" },
        { uid: "u2", completed_count: "0", total_count: "4" },
      ],
    });
    expect(await getCourseCompletionRates("c1")).toEqual([
      { uid: "u1", completed: 3, total: 4, rate: 0.75 },
      { uid: "u2", completed: 0, total: 4, rate: 0 },
    ]);
  });

  it("does not divide by zero for a course nobody has touched", async () => {
    query.mockResolvedValueOnce({ rows: [{ uid: "u1", completed_count: "0", total_count: "0" }] });
    const [row] = await getCourseCompletionRates("c1");
    expect(row.rate).toBe(0);
  });
});
