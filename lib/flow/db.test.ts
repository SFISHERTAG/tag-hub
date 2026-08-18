import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Story: getFullFramework() is a 30-100+ query serial waterfall (Phase 2
 * item 2.5). This proves the cache actually avoids re-running it within the
 * TTL, and that a write clears it so a stale read never lingers.
 */

const query = vi.fn();
vi.mock("@/lib/postgres", () => ({
  pool: { query: (...args: unknown[]) => query(...args) },
}));

const { getFullFramework, updateScript } = await import("./db");

function mockFrameworkRows() {
  query
    .mockResolvedValueOnce({ rows: [{ id: "fw1", version: "v1" }] }) // getFramework
    .mockResolvedValueOnce({ rows: [{ id: "tab1", label: "Tab 1", icon: null, color: null }] }) // tabs
    .mockResolvedValueOnce({ rows: [{ id: "sec1", label: "Section 1", description: null }] }) // sections
    .mockResolvedValueOnce({ rows: [{ id: "card1", key: "k1", label: "Card 1", sub_label: null }] }) // cards
    .mockResolvedValueOnce({ rows: [] }); // scripts for card1
}

beforeEach(() => {
  query.mockReset();
  vi.useRealTimers();
});

describe("getFullFramework caching", () => {
  it("serves a second load within the TTL from cache, without re-querying", async () => {
    mockFrameworkRows();
    const first = await getFullFramework("org-cache-1");
    const queriesForFirstLoad = query.mock.calls.length;
    expect(queriesForFirstLoad).toBeGreaterThan(1); // the waterfall really ran

    const second = await getFullFramework("org-cache-1");

    expect(query.mock.calls.length).toBe(queriesForFirstLoad); // no new queries
    expect(second).toEqual(first);
  });

  it("re-queries after a write invalidates the cache", async () => {
    mockFrameworkRows();
    await getFullFramework("org-cache-2");
    const queriesAfterFirstLoad = query.mock.calls.length;

    // A write anywhere in the framework (e.g. an approved script edit).
    query.mockResolvedValueOnce({
      rows: [{ id: "script1", content: "updated", why: null, notes: null }],
    });
    await updateScript("script1", { content: "updated" });

    mockFrameworkRows();
    await getFullFramework("org-cache-2");

    expect(query.mock.calls.length).toBeGreaterThan(queriesAfterFirstLoad + 1);
  });

  it("caches org A and org B independently", async () => {
    mockFrameworkRows();
    await getFullFramework("org-a");
    const queriesAfterOrgA = query.mock.calls.length;

    mockFrameworkRows();
    await getFullFramework("org-b");

    expect(query.mock.calls.length).toBeGreaterThan(queriesAfterOrgA);
  });
});
