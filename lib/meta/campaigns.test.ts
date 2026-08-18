import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Story: this is the exact "$0 spend" bug named in the Phase 2 brief — a
 * revoked token or a rate-limited insights call used to render as real,
 * plausible-looking zeroed metrics next to genuine data for other campaigns.
 * A failure must now fail the whole call instead of blending in.
 */

const isMetaConfigured = vi.fn(() => true);
const call = vi.fn();
const getMetaApi = vi.fn(() => ({ call }));

vi.mock("./client", () => ({
  getMetaApi: () => getMetaApi(),
  isMetaConfigured: () => isMetaConfigured(),
  MetaApiError: class MetaApiError extends Error {},
}));

const { getAdAccountCampaigns, getCampaignDetail } = await import("./campaigns");

beforeEach(() => {
  vi.clearAllMocks();
  isMetaConfigured.mockReturnValue(true);
});

describe("getAdAccountCampaigns", () => {
  it("returns an error, not zeroed metrics, when one campaign's insights call fails", async () => {
    call
      .mockResolvedValueOnce({
        data: [
          { id: "c1", name: "Campaign 1", status: "ACTIVE", created_time: "2026-01-01" },
        ],
      })
      // The insights call for c1 fails (e.g. revoked token, rate limit).
      .mockRejectedValueOnce(new Error("revoked token"));

    const result = await getAdAccountCampaigns("act_123");

    expect(result.error).not.toBeNull();
    expect(result.data).toBeNull();
    // Specifically not the old bug: campaign present with spend_24h: 0.
    expect(result).not.toEqual({
      data: [expect.objectContaining({ id: "c1", spend_24h: 0 })],
      error: null,
    });
  });

  it("returns real data on success", async () => {
    call
      .mockResolvedValueOnce({
        data: [{ id: "c1", name: "Campaign 1", status: "ACTIVE", created_time: "2026-01-01" }],
      })
      .mockResolvedValueOnce({
        data: [{ spend: "42.50", impressions: "100", clicks: "5", conversions: "2" }],
      });

    const result = await getAdAccountCampaigns("act_123");

    expect(result.error).toBeNull();
    expect(result.data?.[0]).toMatchObject({ id: "c1", spend_24h: 42.5 });
  });

  it("returns an empty, error-free result when Meta isn't configured — an expected state, not a failure", async () => {
    isMetaConfigured.mockReturnValue(false);

    const result = await getAdAccountCampaigns("act_123");

    expect(result).toEqual({ data: [], error: null });
    expect(call).not.toHaveBeenCalled();
  });
});

describe("getCampaignDetail", () => {
  it("returns an error, not null, on a failed call", async () => {
    call.mockRejectedValueOnce(Object.assign(new Error("Forbidden"), { status: 403 }));

    const result = await getCampaignDetail("c1");

    expect(result.error).not.toBeNull();
    expect(result.error?.status).toBe(403);
    expect(result.data).toBeNull();
  });
});
