import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Story 6.3 AC5: a Meta Conversions API failure must never propagate out of
 * dispatchClosedWon(). closeOpportunityAction (Story 2.6) fires this as a
 * fire-and-forget follow-on after the GHL close write already succeeded — if
 * this function could throw, an unrelated Meta outage could look like it
 * broke closing a deal, which is the closer's actual work.
 */

import { FakeStore, fakeRepository } from "@/lib/data/fake-repository";

/*
 * Uses the repository seam's own in-memory fake rather than a hand-rolled
 * Firestore stub (story 14.1). The stub here implemented `.doc(path).set()`
 * and nothing else, so it broke the moment the call site moved to a
 * parent-scoped accessor — which is the point: a stub that mirrors one
 * caller's usage silently encodes that usage as the contract.
 *
 * FakeStore keys documents by full path, same as the stub did, so the
 * assertions below still read the exact path they always did.
 */
const store = new FakeStore();
const { repository } = fakeRepository(store);

vi.mock("@/lib/data", async () => {
  const actual = await vi.importActual<typeof import("@/lib/data")>("@/lib/data");
  return { ...actual, repository: () => repository };
});

vi.mock("@/lib/ghl/contacts", () => ({
  getContact: vi.fn(async (_locationId: string, contactId: string) => ({
    id: contactId,
    email: "prospect@example.com",
    phone: "+15551234567",
    lastAttributionSource: {
      utmAdId: "ad_123",
      fbc: "fb.1.111.aaa",
      fbp: "fb.1.222.bbb",
    },
  })),
}));

const contact = {
  id: "contact789",
  email: "prospect@example.com",
  phone: "+15551234567",
  lastAttributionSource: {
    utmAdId: "ad_123",
    fbc: "fb.1.111.aaa",
    fbp: "fb.1.222.bbb",
  },
};

beforeEach(() => {
  for (const path of Object.keys(store.snapshot())) store.remove(path);
  vi.stubEnv("META_PIXEL_ID", "test-pixel");
  vi.stubEnv("META_SYSTEM_USER_TOKEN", "test-token");
});

describe("dispatchClosedWon", () => {
  it("never throws when the Meta API call rejects outright", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("simulated Meta API outage");
      }),
    );

    const { dispatchClosedWon } = await import("@/lib/meta/conversions");

    await expect(
      dispatchClosedWon("loc123", "opp456", contact as never, 18000),
    ).resolves.toBeUndefined();

    const logged = store.read(
      "locations/loc123/metaConversionLog/closed_won_opp456",
    );
    expect(logged?.status).toBe("failed");
  });

  it("never throws when the Meta API returns a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      })),
    );

    const { dispatchClosedWon } = await import("@/lib/meta/conversions");

    await expect(
      dispatchClosedWon("loc123", "opp789", contact as never, 18000),
    ).resolves.toBeUndefined();

    const logged = store.read(
      "locations/loc123/metaConversionLog/closed_won_opp789",
    );
    expect(logged?.status).toBe("failed");
  });

  it("logs a sent event and calls Meta with hashed identifiers and value on success", async () => {
    const fetchMock = vi.fn(async (_url: string, _options: RequestInit) => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ events_received: 1 }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { dispatchClosedWon } = await import("@/lib/meta/conversions");
    await dispatchClosedWon("loc123", "opp999", contact as never, 18000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const [url, options] = call;
    expect(String(url)).toContain("/test-pixel/events");
    const body = JSON.parse(options.body as string);
    expect(body.data[0].event_name).toBe("Purchase");
    expect(body.data[0].event_id).toBe("opp999");
    expect(body.data[0].custom_data.value).toBe(18000);
    expect(body.data[0].custom_data.currency).toBe("USD");
    // Raw email/phone must never leave the process — only their hashes.
    expect(JSON.stringify(body)).not.toContain("prospect@example.com");
    expect(body.data[0].user_data.em[0]).toMatch(/^[a-f0-9]{64}$/);

    const logged = store.read(
      "locations/loc123/metaConversionLog/closed_won_opp999",
    );
    expect(logged?.status).toBe("sent");
  });

  it("still sends value: 0 when the deal closed won with no value entered", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ events_received: 1 }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { dispatchClosedWon } = await import("@/lib/meta/conversions");
    await dispatchClosedWon("loc123", "opp000", contact as never, 0);

    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(call[1].body as string);
    expect(body.data[0].custom_data.value).toBe(0);

    const logged = store.read(
      "locations/loc123/metaConversionLog/closed_won_opp000",
    );
    expect(logged?.status).toBe("sent");
    expect(logged?.value).toBe(0);
  });

  it("skips (does not call Meta) and logs when value is negative", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { dispatchClosedWon } = await import("@/lib/meta/conversions");
    await dispatchClosedWon("loc123", "opp111", contact as never, -50);

    expect(fetchMock).not.toHaveBeenCalled();
    const logged = store.read(
      "locations/loc123/metaConversionLog/closed_won_opp111",
    );
    expect(logged?.status).toBe("skipped");
  });
});
