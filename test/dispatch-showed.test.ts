import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Story 6.2 AC5: a Meta Conversions API failure must never propagate out of
 * dispatchShowed(). markAppointment (Story 2.3) fires this as a
 * fire-and-forget follow-on after the GHL write already succeeded — if this
 * function could throw, an unrelated Meta outage could look like it broke
 * "marking showed," which is the one thing that must always work.
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

beforeEach(() => {
  for (const path of Object.keys(store.snapshot())) store.remove(path);
  vi.stubEnv("META_PIXEL_ID", "test-pixel");
  vi.stubEnv("META_SYSTEM_USER_TOKEN", "test-token");
});

describe("dispatchShowed", () => {
  it("never throws when the Meta API call rejects outright", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("simulated Meta API outage");
      }),
    );

    const { dispatchShowed } = await import("@/lib/meta/conversions");

    await expect(
      dispatchShowed("loc123", "appt456", "contact789"),
    ).resolves.toBeUndefined();

    const logged = store.read(
      "locations/loc123/metaConversionLog/showed_appt456",
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

    const { dispatchShowed } = await import("@/lib/meta/conversions");

    await expect(
      dispatchShowed("loc123", "appt789", "contact789"),
    ).resolves.toBeUndefined();

    const logged = store.read(
      "locations/loc123/metaConversionLog/showed_appt789",
    );
    expect(logged?.status).toBe("failed");
  });

  it("logs a sent event and calls Meta with hashed identifiers on success", async () => {
    const fetchMock = vi.fn(async (_url: string, _options: RequestInit) => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ events_received: 1 }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { dispatchShowed } = await import("@/lib/meta/conversions");
    await dispatchShowed("loc123", "appt999", "contact789");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/test-pixel/events");
    const body = JSON.parse(options.body as string);
    expect(body.data[0].event_name).toBe("ViewContent");
    expect(body.data[0].event_id).toBe("appt999");
    // Raw email/phone must never leave the process — only their hashes.
    expect(JSON.stringify(body)).not.toContain("prospect@example.com");
    expect(body.data[0].user_data.em[0]).toMatch(/^[a-f0-9]{64}$/);

    const logged = store.read(
      "locations/loc123/metaConversionLog/showed_appt999",
    );
    expect(logged?.status).toBe("sent");
  });
});
