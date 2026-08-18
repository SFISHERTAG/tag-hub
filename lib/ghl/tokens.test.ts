import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Story: resolveToken() documents a 4-tier fallback chain but the whole
 * thing lived in one try/catch — a tier 2 (direct-install refresh) failure
 * fell straight to the catch-all, which only knows how to fall through to
 * tier 4 (dev PIT), skipping tier 3 (agency-mint) entirely even when it
 * could have served the request.
 */

const loadLocationToken = vi.fn();
const saveLocationToken = vi.fn();
const loadAgencyToken = vi.fn();
const saveAgencyToken = vi.fn();
const listStoredLocationIds = vi.fn(async () => []);

vi.mock("./store", () => ({
  loadLocationToken: (...args: [string]) => loadLocationToken(...args),
  saveLocationToken: (...args: [string, unknown]) => saveLocationToken(...args),
  loadAgencyToken: () => loadAgencyToken(),
  saveAgencyToken: (...args: [unknown]) => saveAgencyToken(...args),
  listStoredLocationIds: () => listStoredLocationIds(),
}));

const refreshAgencyToken = vi.fn();
const mintLocationToken = vi.fn();

vi.mock("./oauth", () => ({
  refreshAgencyToken: (...args: [string]) => refreshAgencyToken(...args),
  mintLocationToken: (...args: [string, string, string]) => mintLocationToken(...args),
}));

const { resolveToken, LocationNotAuthorizedError } = await import("./tokens");

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("resolveToken fallback chain", () => {
  it("tier 1: returns a fresh cached token without touching later tiers", async () => {
    loadLocationToken.mockResolvedValue({
      accessToken: "cached-token",
      expiresAt: Date.now() + 10 * 60_000,
      source: "agency-mint",
      updatedAt: Date.now(),
    });

    const token = await resolveToken("loc1");

    expect(token).toBe("cached-token");
    expect(refreshAgencyToken).not.toHaveBeenCalled();
    expect(loadAgencyToken).not.toHaveBeenCalled();
  });

  it("tier 2 failure falls through to tier 3 instead of aborting", async () => {
    loadLocationToken.mockResolvedValue({
      accessToken: "expired",
      expiresAt: Date.now() - 1000,
      refreshToken: "refresh-token",
      source: "direct-install",
      updatedAt: 0,
    });
    refreshAgencyToken.mockRejectedValue(new Error("refresh_token revoked"));
    loadAgencyToken.mockResolvedValue({
      accessToken: "agency-access",
      refreshToken: "agency-refresh",
      companyId: "company1",
      expiresAt: Date.now() + 10 * 60_000,
      updatedAt: 0,
    });
    mintLocationToken.mockResolvedValue({
      access_token: "minted-token",
      expires_in: 3600,
      locationId: "loc1",
    });

    const token = await resolveToken("loc1");

    expect(token).toBe("minted-token");
    expect(refreshAgencyToken).toHaveBeenCalledWith("refresh-token");
    expect(mintLocationToken).toHaveBeenCalledWith("agency-access", "company1", "loc1");
    expect(saveLocationToken).toHaveBeenCalledWith(
      "loc1",
      expect.objectContaining({ accessToken: "minted-token", source: "agency-mint" }),
    );
  });

  it("all tiers failing throws a clear config error, not a silent fallback", async () => {
    loadLocationToken.mockResolvedValue(null);
    loadAgencyToken.mockResolvedValue(null);
    vi.stubEnv("GHL_PIT", "");
    vi.stubEnv("GHL_LOCATION_ID", "");

    await expect(resolveToken("loc1")).rejects.toThrow(/No GHL credential available/);
  });

  it("all tiers failing except a dev PIT for a different location throws LocationNotAuthorizedError", async () => {
    loadLocationToken.mockResolvedValue(null);
    loadAgencyToken.mockResolvedValue(null);
    vi.stubEnv("GHL_PIT", "dev-pit-token");
    vi.stubEnv("GHL_LOCATION_ID", "other-location");

    await expect(resolveToken("loc1")).rejects.toThrow(LocationNotAuthorizedError);
  });
});
