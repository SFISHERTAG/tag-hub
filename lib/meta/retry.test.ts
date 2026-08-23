import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeStore, fakeRepository } from "@/lib/data/fake-repository";

/**
 * Story 6.5 AC6: an intentional failure must actually exercise the retry
 * path end to end — not just prove the logging shape is right. This test
 * fakes Firestore (in-memory) and the Meta HTTP call, then drives the real
 * dispatchShowed -> runMetaRetryJob -> retried-and-sent sequence, including
 * the eventId-stability check that keeps a lost-response retry from
 * becoming a duplicate Meta record.
 */

type StoredDoc = Record<string, unknown>;

/*
 * Uses the repository seam's in-memory fake (story 14.1).
 *
 * What stood here was ~90 lines re-implementing Firestore: a document store, a
 * query builder, and a hand-written collectionGroup that matched on the
 * second-to-last path segment and re-implemented == and >= comparisons. All of
 * that now lives in lib/data/fake-repository.ts, tested in its own right, and
 * shared with every other test rather than reinvented per file.
 *
 * The old fake was also the reason this test could pass while being wrong: it
 * encoded one caller's usage as the contract, so it would not have noticed the
 * call site changing shape underneath it.
 */
const store = new FakeStore();
const { repository } = fakeRepository(store);

vi.mock("@/lib/data", async () => {
  const actual = await vi.importActual<typeof import("@/lib/data")>("@/lib/data");
  return { ...actual, repository: () => repository };
});

const getContactMock = vi.fn();
vi.mock("@/lib/ghl/contacts", () => ({ getContact: (...args: unknown[]) => getContactMock(...args) }));

const postAlertMock = vi.fn(async (_text: string) => {});
const slackConfiguredMock = vi.fn(() => false);
vi.mock("@/lib/slack", () => ({
  slackConfigured: () => slackConfiguredMock(),
  postAlert: (text: string) => postAlertMock(text),
}));

const CONTACT = {
  id: "contact_1",
  email: "lead@example.com",
  phone: "+15551234567",
  lastAttributionSource: { utmAdId: "ad_123", fbc: "fb.1.1.abc" },
};

function mockFetchSequence(responses: Array<{ ok: boolean; body: unknown }>) {
  let call = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const r = responses[Math.min(call, responses.length - 1)];
      call += 1;
      return {
        ok: r.ok,
        status: r.ok ? 200 : 500,
        text: async () => JSON.stringify(r.body),
      };
    }),
  );
}

beforeEach(() => {
  for (const path of Object.keys(store.snapshot())) store.remove(path);
  getContactMock.mockReset();
  getContactMock.mockResolvedValue(CONTACT);
  postAlertMock.mockReset();
  postAlertMock.mockResolvedValue(undefined);
  slackConfiguredMock.mockReset();
  slackConfiguredMock.mockReturnValue(false);
  vi.unstubAllGlobals();
  process.env.META_PIXEL_ID = "pixel_123";
  process.env.META_SYSTEM_USER_TOKEN = "token_123";
});

describe("Story 6.5 retry path (AC6)", () => {
  it("retries a failed dispatch and marks it sent once Meta confirms receipt", async () => {
    // Meta rejects the original send (network/API error).
    mockFetchSequence([{ ok: false, body: { error: { message: "rate limited" } } }]);

    const { dispatchShowed } = await import("@/lib/meta/conversions");
    await dispatchShowed("loc_1", "appt_1", "contact_1");

    const failedDoc = store.read("locations/loc_1/metaConversionLog/showed_appt_1");
    expect(failedDoc?.status).toBe("failed");
    expect(failedDoc?.attemptCount).toBe(1);
    expect(failedDoc?.eventId).toBe("appt_1");
    const originalNextRetryAt = failedDoc?.nextRetryAt as number;
    expect(originalNextRetryAt).toBeGreaterThan(Date.now());

    // Force the backoff window open so the retry job picks it up now.
    store.write("locations/loc_1/metaConversionLog/showed_appt_1", {
      ...failedDoc,
      nextRetryAt: Date.now() - 1,
    });

    // This time Meta confirms receipt.
    mockFetchSequence([{ ok: true, body: { events_received: 1 } }]);

    const { runMetaRetryJob } = await import("@/lib/meta/retry");
    const summary = await runMetaRetryJob();

    expect(summary.scanned).toBe(1);
    expect(summary.retried).toBe(1);
    expect(summary.succeeded).toBe(1);

    const finalDoc = store.read("locations/loc_1/metaConversionLog/showed_appt_1");
    expect(finalDoc?.status).toBe("sent");
    expect(finalDoc?.attemptCount).toBe(2);
    // Idempotency: the retry must reuse the exact same event_id as the
    // original dispatch, so Meta dedupes rather than double-counting.
    expect(finalDoc?.eventId).toBe("appt_1");
  });

  it("does not retry a failure whose backoff window hasn't elapsed yet", async () => {
    store.write("locations/loc_1/metaConversionLog/showed_appt_2", {
      locationId: "loc_1",
      eventType: "showed",
      entityId: "appt_2",
      contactId: "contact_1",
      status: "failed",
      eventId: "appt_2",
      timestamp: Date.now(),
      createdAt: Date.now(),
      attemptCount: 1,
      lastAttemptAt: Date.now(),
      nextRetryAt: Date.now() + 60_000, // still 1 minute out
    });

    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { runMetaRetryJob } = await import("@/lib/meta/retry");
    const summary = await runMetaRetryJob();

    expect(summary.retried).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("escalates to the dead-letter queue and alerts after MAX_ATTEMPTS is reached", async () => {
    store.write("locations/loc_1/metaConversionLog/showed_appt_3", {
      locationId: "loc_1",
      eventType: "showed",
      entityId: "appt_3",
      contactId: "contact_1",
      status: "failed",
      eventId: "appt_3",
      utmAdId: "ad_123",
      timestamp: Date.now(),
      createdAt: Date.now(),
      attemptCount: 3, // one retry away from MAX_ATTEMPTS (4)
      lastAttemptAt: Date.now(),
      nextRetryAt: Date.now() - 1,
    });

    slackConfiguredMock.mockReturnValue(true);
    mockFetchSequence([{ ok: false, body: { error: { message: "still down" } } }]);

    const { runMetaRetryJob } = await import("@/lib/meta/retry");
    const summary = await runMetaRetryJob();

    expect(summary.escalated).toBe(1);

    const finalDoc = store.read("locations/loc_1/metaConversionLog/showed_appt_3");
    expect(finalDoc?.attemptCount).toBe(4);
    expect(finalDoc?.alertedAt).toBeTruthy();
    expect(finalDoc?.nextRetryAt).toBeUndefined();

    const dlqEntries = Object.entries(store.snapshot()).filter(([path]) => path.startsWith("webhookDeadLetter/"));
    expect(dlqEntries).toHaveLength(1);
    expect(dlqEntries[0][1].flagged).toBe(true);

    expect(postAlertMock).toHaveBeenCalledTimes(1);
  });
});
