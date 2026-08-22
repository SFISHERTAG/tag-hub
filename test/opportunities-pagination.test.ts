import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Stream 1.2. getOpportunities capped results at its limit (default 100) and
 * ignored meta.nextPageUrl entirely, so any metric summing its output covered
 * at most the first page — a number that silently stops growing with the
 * business. searchAllOpportunities follows nextPageUrl to exhaustion, refuses
 * to leave the GHL host, and fails loudly past a sanity cap instead of
 * returning a clipped sum as if it were complete.
 */

const ghl = vi.fn();
vi.mock("@/lib/ghl/client", () => ({
  ghl: (...args: unknown[]) => ghl(...args),
  GhlError: class GhlError extends Error {},
}));

import { searchAllOpportunities } from "@/lib/ghl/opportunities";

function opp(id: string) {
  return {
    id,
    name: id,
    pipelineId: "pipe-1",
    pipelineStageId: "st-1",
    status: "open",
    monetaryValue: 1,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

const NEXT = "https://services.leadconnectorhq.com/opportunities/search?page=2";

beforeEach(() => ghl.mockReset());

describe("searchAllOpportunities", () => {
  it("follows nextPageUrl until the pages run out", async () => {
    ghl
      .mockResolvedValueOnce({ opportunities: [opp("a")], meta: { nextPageUrl: NEXT } })
      .mockResolvedValueOnce({ opportunities: [opp("b")], meta: { nextPageUrl: null } });

    const rows = await searchAllOpportunities("loc-1", "pipe-1", { status: "open" });
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
    expect(ghl).toHaveBeenCalledTimes(2);
  });

  it("passes the follow-up URL through the ghl client, keeping the access check", async () => {
    ghl
      .mockResolvedValueOnce({ opportunities: [opp("a")], meta: { nextPageUrl: NEXT } })
      .mockResolvedValueOnce({ opportunities: [], meta: {} });

    await searchAllOpportunities("loc-1", "pipe-1", { status: "open" });
    expect(ghl.mock.calls[1][0]).toBe("loc-1");
    expect(ghl.mock.calls[1][1]).toBe(NEXT);
  });

  it("refuses a nextPageUrl that leaves the GHL host", async () => {
    ghl.mockResolvedValueOnce({
      opportunities: [opp("a")],
      meta: { nextPageUrl: "https://evil.example.com/opportunities/search?page=2" },
    });

    await expect(searchAllOpportunities("loc-1", "pipe-1", { status: "open" })).rejects.toThrow(
      /host/i,
    );
  });

  it("fails loudly rather than returning a silently clipped set", async () => {
    // Every page claims another page exists. A sane cap must throw, because
    // returning what was fetched so far would be the truncation bug again.
    ghl.mockResolvedValue({ opportunities: [opp("x")], meta: { nextPageUrl: NEXT } });

    await expect(searchAllOpportunities("loc-1", "pipe-1", { status: "open" })).rejects.toThrow(
      /page/i,
    );
  });
});
