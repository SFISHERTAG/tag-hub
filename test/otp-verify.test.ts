import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * lib/auth/otp.ts talks to Firestore through `new Firestore(...)` from
 * @google-cloud/firestore directly (not the shared lib/firestore.ts
 * wrapper), so that module is what gets mocked here.
 *
 * The fake `runTransaction` below is not a pass-through: it serializes
 * concurrent transaction bodies behind a single queue, the same guarantee
 * Firestore's transaction isolation gives verifyCode. A fake that just
 * invoked the callback inline would let concurrent bodies interleave their
 * get()/write() calls exactly like the pre-fix three-call race, which would
 * make the race test below pass even against the old, broken
 * get()-then-update() implementation. Serializing here is what makes the
 * test actually exercise the property it's meant to check.
 */

type DocData = Record<string, unknown> | undefined;

class FakeTimestamp {
  constructor(private readonly ms: number) {}
  toMillis() {
    return this.ms;
  }
  static fromMillis(ms: number) {
    return new FakeTimestamp(ms);
  }
  static now() {
    return new FakeTimestamp(Date.now());
  }
}

type FakeRef = { path: string };
type FakeTx = {
  get(ref: FakeRef): Promise<{ exists: boolean; data: () => DocData }>;
  set(ref: FakeRef, data: Record<string, unknown>): void;
  update(ref: FakeRef, patch: Record<string, unknown>): void;
  delete(ref: FakeRef): void;
};

const { fakeFirestore, FirestoreCtor } = vi.hoisted(() => {
  const docs = new Map<string, DocData>();
  let lock: Promise<void> = Promise.resolve();

  function ref(path: string): FakeRef {
    return { path };
  }

  class FakeFirestoreClient {
    doc(path: string) {
      const r = ref(path);
      return {
        ...r,
        async get() {
          const data = docs.get(path);
          return { exists: data !== undefined, data: () => data };
        },
        async set(data: Record<string, unknown>) {
          docs.set(path, data);
        },
        async update(patch: Record<string, unknown>) {
          docs.set(path, { ...(docs.get(path) ?? {}), ...patch });
        },
        async delete() {
          docs.delete(path);
        },
      };
    }

    async runTransaction<T>(
      fn: (tx: FakeTx) => Promise<T>,
    ): Promise<T> {
      // Chain this call behind whatever is already queued, so at most one
      // transaction body is reading/writing at a time - the property that
      // makes the race test below meaningful.
      const previous = lock;
      let release!: () => void;
      lock = new Promise((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        const tx: FakeTx = {
          get: async (r) => {
            const data = docs.get(r.path);
            return { exists: data !== undefined, data: () => data };
          },
          set: (r, data) => {
            docs.set(r.path, data);
          },
          update: (r, patch) => {
            docs.set(r.path, { ...(docs.get(r.path) ?? {}), ...patch });
          },
          delete: (r) => {
            docs.delete(r.path);
          },
        };
        return await fn(tx);
      } finally {
        release();
      }
    }
  }

  return { fakeFirestore: { docs }, FirestoreCtor: FakeFirestoreClient };
});

vi.mock("@google-cloud/firestore", () => ({
  Firestore: FirestoreCtor,
  Timestamp: FakeTimestamp,
}));

function onlyDoc(): Record<string, unknown> | undefined {
  const values = [...fakeFirestore.docs.values()];
  return values[0] as Record<string, unknown> | undefined;
}

function wrongCodeFor(realCode: string): string {
  return realCode === "000000" ? "111111" : "000000";
}

beforeEach(() => {
  fakeFirestore.docs.clear();
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("verifyCode", () => {
  it("accepts the correct code once and deletes the doc (single use)", async () => {
    const { issueCode, verifyCode } = await import("@/lib/auth/otp");
    const email = "correct@example.com";
    const issued = await issueCode(email);
    if (!issued.sent) throw new Error("expected issueCode to succeed");

    const result = await verifyCode(email, issued.code);
    expect(result).toEqual({ ok: true });
    expect(onlyDoc()).toBeUndefined();

    // Single use: replaying the same code against the now-deleted doc fails.
    const replay = await verifyCode(email, issued.code);
    expect(replay).toEqual({ ok: false, reason: "invalid" });
  });

  it("increments attempts on a wrong guess without locking below the cap", async () => {
    const { issueCode, verifyCode } = await import("@/lib/auth/otp");
    const email = "wrong-once@example.com";
    const issued = await issueCode(email);
    if (!issued.sent) throw new Error("expected issueCode to succeed");

    const result = await verifyCode(email, wrongCodeFor(issued.code));
    expect(result).toEqual({ ok: false, reason: "invalid" });
    expect(onlyDoc()?.attempts).toBe(1);
    expect(onlyDoc()?.locked).toBeUndefined();
  });

  /**
   * The regression this file exists for: verifyCode used to do a plain
   * get() then a separate update(), so concurrent guesses could all read
   * the same stale `attempts` count before any of them wrote back, racing
   * past MAX_ATTEMPTS (5). Wrapping the read-check-write in a Firestore
   * transaction closes that gap. Firing 10 concurrent wrong guesses at once
   * and checking the outcome distribution catches a regression either way:
   * a broken (non-atomic) implementation would let most or all 10 land as
   * "invalid" off a stale read of attempts=0, instead of exactly 5 landing
   * before the doc locks.
   */
  it("caps failed attempts at MAX_ATTEMPTS under 10 concurrent guesses", async () => {
    const { issueCode, verifyCode } = await import("@/lib/auth/otp");
    const email = "race@example.com";
    const issued = await issueCode(email);
    if (!issued.sent) throw new Error("expected issueCode to succeed");

    const wrong = wrongCodeFor(issued.code);

    const results = await Promise.all(
      Array.from({ length: 10 }, () => verifyCode(email, wrong)),
    );

    // None of the 10 guesses were correct, so nothing should ever succeed.
    expect(results.every((r) => !r.ok)).toBe(true);

    const reasons = results.map((r) => (r as { reason: string }).reason);
    const invalidCount = reasons.filter((r) => r === "invalid").length;
    const lockedCount = reasons.filter((r) => r === "too-many-attempts").length;

    // Exactly MAX_ATTEMPTS (5) guesses are the ones that actually observe
    // and increment the counter; the rest see the doc already locked. A
    // racing implementation would not split 5/5 this cleanly - it would let
    // far more than 5 report "invalid" because they all incremented off the
    // same stale read.
    expect(invalidCount).toBe(5);
    expect(lockedCount).toBe(5);

    const finalDoc = onlyDoc();
    expect(finalDoc).toBeDefined();
    expect(finalDoc?.locked).toBe(true);
    expect(finalDoc?.attempts).toBe(5);
  });

  it("reports a locked doc as too-many-attempts on any further guess", async () => {
    const { issueCode, verifyCode } = await import("@/lib/auth/otp");
    const email = "already-locked@example.com";
    const issued = await issueCode(email);
    if (!issued.sent) throw new Error("expected issueCode to succeed");
    const wrong = wrongCodeFor(issued.code);

    for (let i = 0; i < 5; i++) {
      await verifyCode(email, wrong);
    }
    expect(onlyDoc()?.locked).toBe(true);

    // Even the correct code is rejected once locked - a lock is not just an
    // attempt-count gate, it's a hard stop until a fresh code is issued.
    const result = await verifyCode(email, issued.code);
    expect(result).toEqual({ ok: false, reason: "too-many-attempts" });
  });

  /**
   * A locked doc must not be a dead end: once the resend cooldown has
   * passed, issueCode's existing ref.set() overwrites the whole document
   * (attempts back to 0, no locked field), so a legitimate user who was
   * locked out can still get back in with a fresh code.
   */
  it("lets issueCode produce a fresh, verifiable code after a lock, once past cooldown", async () => {
    vi.useFakeTimers();
    const { issueCode, verifyCode } = await import("@/lib/auth/otp");
    const email = "locked-then-reissued@example.com";

    const issued = await issueCode(email);
    if (!issued.sent) throw new Error("expected issueCode to succeed");
    const wrong = wrongCodeFor(issued.code);

    for (let i = 0; i < 5; i++) {
      await verifyCode(email, wrong);
    }
    expect(onlyDoc()?.locked).toBe(true);

    // Still inside the 60s resend cooldown: throttled exactly as before,
    // lock or no lock.
    const tooSoon = await issueCode(email);
    expect(tooSoon.sent).toBe(false);

    vi.advanceTimersByTime(61_000);

    const reissued = await issueCode(email);
    if (!reissued.sent) throw new Error("expected reissueCode to succeed");
    expect(reissued.code).not.toBe(issued.code);
    expect(onlyDoc()?.locked).toBeUndefined();
    expect(onlyDoc()?.attempts).toBe(0);

    const verified = await verifyCode(email, reissued.code);
    expect(verified).toEqual({ ok: true });
  });

  it("treats a doc past its expiry as expired and deletes it", async () => {
    vi.useFakeTimers();
    const { issueCode, verifyCode } = await import("@/lib/auth/otp");
    const email = "expired@example.com";
    const issued = await issueCode(email);
    if (!issued.sent) throw new Error("expected issueCode to succeed");

    vi.advanceTimersByTime(11 * 60 * 1000); // past the 10-minute TTL

    const result = await verifyCode(email, issued.code);
    expect(result).toEqual({ ok: false, reason: "expired" });
    expect(onlyDoc()).toBeUndefined();
  });

  it("reports invalid for an email with no issued code", async () => {
    const { verifyCode } = await import("@/lib/auth/otp");
    const result = await verifyCode("never-issued@example.com", "123456");
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });
});
