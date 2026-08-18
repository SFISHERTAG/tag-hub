import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Story 6.5 AC6: an intentional failure must actually exercise the retry
 * path end to end — not just prove the logging shape is right. This test
 * fakes Firestore (in-memory) and the Meta HTTP call, then drives the real
 * dispatchShowed -> runMetaRetryJob -> retried-and-sent sequence, including
 * the eventId-stability check that keeps a lost-response retry from
 * becoming a duplicate Meta record.
 */

type StoredDoc = Record<string, unknown>;

class FakeFirestore {
  store = new Map<string, StoredDoc>();

  doc(path: string) {
    const store = this.store;
    return {
      async set(data: StoredDoc, opts?: { merge?: boolean }) {
        const existing = opts?.merge ? (store.get(path) ?? {}) : {};
        store.set(path, { ...existing, ...data });
      },
      async update(data: StoredDoc) {
        const existing = store.get(path) ?? {};
        store.set(path, { ...existing, ...data });
      },
      async get() {
        const data = store.get(path);
        return { exists: Boolean(data), data: () => data };
      },
    };
  }

  collection(name: string) {
    const store = this.store;
    let counter = 0;
    return {
      async add(data: StoredDoc) {
        const id = `auto_${counter++}_${Date.now()}`;
        store.set(`${name}/${id}`, { ...data });
        return { id };
      },
      doc(id: string) {
        return this.parentDoc(`${name}/${id}`);
      },
      parentDoc(path: string) {
        return {
          async update(data: StoredDoc) {
            const existing = store.get(path) ?? {};
            store.set(path, { ...existing, ...data });
          },
        };
      },
      where() {
        return this;
      },
      orderBy() {
        return this;
      },
      limit() {
        return this;
      },
      async get() {
        const docs = [...store.entries()]
          .filter(([path]) => path.startsWith(`${name}/`))
          .map(([path, data]) => ({ id: path.split("/").pop()!, ...data }));
        return docs;
      },
    };
  }

  collectionGroup(name: string) {
    const store = this.store;
    type Filter = { field: string; op: string; value: unknown };
    const filters: Filter[] = [];

    const query = {
      where(field: string, op: string, value: unknown) {
        filters.push({ field, op, value });
        return query;
      },
      async get() {
        const docs = [...store.entries()]
          .filter(([path]) => {
            const segments = path.split("/");
            return segments[segments.length - 2] === name;
          })
          .filter(([, data]) =>
            filters.every((f) => {
              const actual = data[f.field] as number | string | undefined;
              if (f.op === "==") return actual === f.value;
              if (f.op === ">=") return typeof actual === "number" && actual >= (f.value as number);
              return true;
            }),
          )
          .map(([path, data]) => ({
            ref: { path, parent: { parent: { id: path.split("/")[1] } } },
            data: () => data,
          }));
        return { docs, size: docs.length };
      },
    };
    return query;
  }
}

const fake = new FakeFirestore();

vi.mock("@/lib/firestore", () => ({ firestore: () => fake }));

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
  fake.store.clear();
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

    const failedDoc = fake.store.get("locations/loc_1/metaConversionLog/showed_appt_1");
    expect(failedDoc?.status).toBe("failed");
    expect(failedDoc?.attemptCount).toBe(1);
    expect(failedDoc?.eventId).toBe("appt_1");
    const originalNextRetryAt = failedDoc?.nextRetryAt as number;
    expect(originalNextRetryAt).toBeGreaterThan(Date.now());

    // Force the backoff window open so the retry job picks it up now.
    fake.store.set("locations/loc_1/metaConversionLog/showed_appt_1", {
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

    const finalDoc = fake.store.get("locations/loc_1/metaConversionLog/showed_appt_1");
    expect(finalDoc?.status).toBe("sent");
    expect(finalDoc?.attemptCount).toBe(2);
    // Idempotency: the retry must reuse the exact same event_id as the
    // original dispatch, so Meta dedupes rather than double-counting.
    expect(finalDoc?.eventId).toBe("appt_1");
  });

  it("does not retry a failure whose backoff window hasn't elapsed yet", async () => {
    fake.store.set("locations/loc_1/metaConversionLog/showed_appt_2", {
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
    fake.store.set("locations/loc_1/metaConversionLog/showed_appt_3", {
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

    const finalDoc = fake.store.get("locations/loc_1/metaConversionLog/showed_appt_3");
    expect(finalDoc?.attemptCount).toBe(4);
    expect(finalDoc?.alertedAt).toBeTruthy();
    expect(finalDoc?.nextRetryAt).toBeUndefined();

    const dlqEntries = [...fake.store.entries()].filter(([path]) => path.startsWith("webhookDeadLetter/"));
    expect(dlqEntries).toHaveLength(1);
    expect(dlqEntries[0][1].flagged).toBe(true);

    expect(postAlertMock).toHaveBeenCalledTimes(1);
  });
});
