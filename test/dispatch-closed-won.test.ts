import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Story 6.3 AC5: a Meta Conversions API failure must never propagate out of
 * dispatchClosedWon(). closeOpportunityAction (Story 2.6) fires this as a
 * fire-and-forget follow-on after the GHL close write already succeeded — if
 * this function could throw, an unrelated Meta outage could look like it
 * broke closing a deal, which is the closer's actual work.
 */

type FakeDoc = { data: Record<string, unknown> | undefined };

function makeFakeFirestore() {
  const docs = new Map<string, FakeDoc>();
  return {
    docs,
    doc(path: string) {
      return {
        async set(data: Record<string, unknown>) {
          docs.set(path, { data });
        },
      };
    },
  };
}

const fakeFirestore = makeFakeFirestore();

vi.mock("@/lib/firestore", () => ({
  firestore: () => fakeFirestore,
}));

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
  fakeFirestore.docs.clear();
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

    const logged = fakeFirestore.docs.get(
      "locations/loc123/metaConversionLog/closed_won_opp456",
    );
    expect(logged?.data?.status).toBe("failed");
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

    const logged = fakeFirestore.docs.get(
      "locations/loc123/metaConversionLog/closed_won_opp789",
    );
    expect(logged?.data?.status).toBe("failed");
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

    const logged = fakeFirestore.docs.get(
      "locations/loc123/metaConversionLog/closed_won_opp999",
    );
    expect(logged?.data?.status).toBe("sent");
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

    const logged = fakeFirestore.docs.get(
      "locations/loc123/metaConversionLog/closed_won_opp000",
    );
    expect(logged?.data?.status).toBe("sent");
    expect(logged?.data?.value).toBe(0);
  });

  it("skips (does not call Meta) and logs when value is negative", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { dispatchClosedWon } = await import("@/lib/meta/conversions");
    await dispatchClosedWon("loc123", "opp111", contact as never, -50);

    expect(fetchMock).not.toHaveBeenCalled();
    const logged = fakeFirestore.docs.get(
      "locations/loc123/metaConversionLog/closed_won_opp111",
    );
    expect(logged?.data?.status).toBe("skipped");
  });
});
