import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * The failure this file exists to prevent: a listing that returns `[]` when
 * the token is revoked. Every caller reads an empty ad-account list as "the
 * System User is assigned to nothing" and would tell a human to go re-grant
 * access that was never lost. Same shape as the "$0 spend" bug in
 * campaigns.test.ts, one level up the tree.
 */

const isMetaConfigured = vi.fn(() => true);
const call = vi.fn();
const getMetaApi = vi.fn(() => ({ call }));
const getMetaBusinessId = vi.fn(() => "555000111");

vi.mock("./client", () => ({
  getMetaApi: () => getMetaApi(),
  isMetaConfigured: () => isMetaConfigured(),
  getMetaBusinessId: () => getMetaBusinessId(),
  MetaApiError: class MetaApiError extends Error {},
}));

const { listClientAdAccounts, hasClientAdAccountAccess } = await import("./accounts");

beforeEach(() => {
  vi.clearAllMocks();
  isMetaConfigured.mockReturnValue(true);
  getMetaBusinessId.mockReturnValue("555000111");
});

describe("listClientAdAccounts", () => {
  it("returns an error, not an empty list, when the call fails", async () => {
    call.mockRejectedValueOnce(new Error("(#190) Access token has been revoked"));

    const result = await listClientAdAccounts();

    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
    // Specifically not the bug: a revoked token reading as "no accounts".
    expect(result).not.toEqual({ data: [], error: null });
  });

  it("returns an empty, error-free result when Meta isn't configured", async () => {
    isMetaConfigured.mockReturnValue(false);

    const result = await listClientAdAccounts();

    expect(result).toEqual({ data: [], error: null });
    expect(call).not.toHaveBeenCalled();
  });

  it("hits client_ad_accounts on the configured business ID", async () => {
    call.mockResolvedValueOnce({ data: [] });

    await listClientAdAccounts();

    expect(call).toHaveBeenCalledWith(
      "GET",
      "/555000111/client_ad_accounts",
      expect.objectContaining({ limit: 100 }),
    );
  });

  it("normalizes both ID forms and maps the status code", async () => {
    call.mockResolvedValueOnce({
      data: [
        {
          id: "act_123456789",
          account_id: "123456789",
          name: "Acme Roofing",
          account_status: 1,
          currency: "USD",
          timezone_name: "America/Denver",
        },
      ],
    });

    const result = await listClientAdAccounts();

    expect(result.error).toBeNull();
    expect(result.data?.[0]).toEqual({
      id: "act_123456789",
      accountId: "123456789",
      name: "Acme Roofing",
      accountStatus: 1,
      accountStatusLabel: "ACTIVE",
      currency: "USD",
      timezoneName: "America/Denver",
    });
  });

  it("keeps an unmapped status code instead of dropping it", async () => {
    call.mockResolvedValueOnce({ data: [{ id: "act_1", account_id: "1", account_status: 999 }] });

    const result = await listClientAdAccounts();

    expect(result.data?.[0]).toMatchObject({ accountStatus: 999, accountStatusLabel: null });
  });

  it("walks every page — a truncated first page reads as a complete short list", async () => {
    call
      .mockResolvedValueOnce({
        data: [{ id: "act_1", account_id: "1", name: "Page one" }],
        paging: { cursors: { after: "CURSOR_A" }, next: "https://graph.facebook.com/next" },
      })
      .mockResolvedValueOnce({
        data: [{ id: "act_2", account_id: "2", name: "Page two" }],
      });

    const result = await listClientAdAccounts();

    expect(call).toHaveBeenCalledTimes(2);
    expect(call).toHaveBeenNthCalledWith(
      2,
      "GET",
      "/555000111/client_ad_accounts",
      expect.objectContaining({ after: "CURSOR_A" }),
    );
    expect(result.data?.map((a) => a.accountId)).toEqual(["1", "2"]);
  });

  it("stops when `next` is absent even though a cursor is present", async () => {
    call.mockResolvedValueOnce({
      data: [{ id: "act_1", account_id: "1" }],
      // Meta returns cursors on a terminal page too. Following the cursor
      // without checking `next` re-requests the same page forever.
      paging: { cursors: { after: "CURSOR_A" } },
    });

    await listClientAdAccounts();

    expect(call).toHaveBeenCalledTimes(1);
  });

  it("de-duplicates a row repeated across pages", async () => {
    call
      .mockResolvedValueOnce({
        data: [{ id: "act_1", account_id: "1", name: "Acme" }],
        paging: { cursors: { after: "A" }, next: "u" },
      })
      .mockResolvedValueOnce({
        data: [{ id: "act_1", account_id: "1", name: "Acme" }],
      });

    const result = await listClientAdAccounts();

    expect(result.data).toHaveLength(1);
  });

  it("drops a row with no usable ID rather than inventing one", async () => {
    call.mockResolvedValueOnce({ data: [{ name: "Ghost account" }, { id: "act_9", account_id: "9" }] });

    const result = await listClientAdAccounts();

    expect(result.data?.map((a) => a.accountId)).toEqual(["9"]);
  });
});

describe("hasClientAdAccountAccess", () => {
  it("matches whether or not the caller passed the act_ prefix", async () => {
    call.mockResolvedValue({ data: [{ id: "act_777", account_id: "777", name: "Acme" }] });

    await expect(hasClientAdAccountAccess("777")).resolves.toEqual({ data: true, error: null });
    await expect(hasClientAdAccountAccess("act_777")).resolves.toEqual({ data: true, error: null });
    await expect(hasClientAdAccountAccess("act_888")).resolves.toEqual({ data: false, error: null });
  });

  it("propagates a failure instead of reporting no access", async () => {
    call.mockRejectedValueOnce(new Error("rate limited"));

    const result = await hasClientAdAccountAccess("777");

    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
  });
});
