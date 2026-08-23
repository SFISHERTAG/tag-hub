import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeStore, fakeRepository } from "@/lib/data/fake-repository";

/*
 * First tests for the OTP attempt cap (story 14.1).
 *
 * verifyCode had no coverage anywhere in the repo before this. It could not
 * have: it runs inside a Firestore transaction, so testing it meant reaching a
 * real Firestore. The only test that touched this module, test/otp-request.test.ts,
 * mocks lib/auth/otp wholesale and exercises the route around it.
 *
 * That mattered more than an ordinary coverage gap. A 6-digit code is a million
 * possibilities, and the comment on verifyCode says so: expiry, the attempt cap
 * and single use are the three things making that length safe. All three were
 * asserted by argument and none by test.
 *
 * The repository seam is what makes them testable, which is the clearest
 * argument for the seam that 14.1 has produced.
 */

const store = new FakeStore();
const { repository } = fakeRepository(store);

vi.mock("@/lib/data", async () => {
  const actual = await vi.importActual<typeof import("@/lib/data")>("@/lib/data");
  return { ...actual, repository: () => repository };
});

const { issueCode, verifyCode, checkCooldown, recordCooldown } = await import("./otp");

const EMAIL = "person@example.com";

beforeEach(() => {
  for (const path of Object.keys(store.snapshot())) store.remove(path);
  vi.useRealTimers();
});

describe("verifyCode", () => {
  it("accepts the issued code once", async () => {
    const issued = await issueCode(EMAIL);
    if (!issued.sent) throw new Error("expected a code");

    expect(await verifyCode(EMAIL, issued.code)).toEqual({ ok: true });
  });

  it("refuses to replay a code that already succeeded", async () => {
    const issued = await issueCode(EMAIL);
    if (!issued.sent) throw new Error("expected a code");

    await verifyCode(EMAIL, issued.code);
    // Single use: the document is deleted on success, so a replay is invalid
    // rather than accepted a second time.
    expect(await verifyCode(EMAIL, issued.code)).toEqual({ ok: false, reason: "invalid" });
  });

  it("caps attempts at five and then destroys the code", async () => {
    const issued = await issueCode(EMAIL);
    if (!issued.sent) throw new Error("expected a code");

    for (let i = 0; i < 5; i += 1) {
      expect(await verifyCode(EMAIL, "000000")).toEqual({ ok: false, reason: "invalid" });
    }

    // Sixth guess is refused on the cap, not on the code.
    expect(await verifyCode(EMAIL, "000000")).toEqual({
      ok: false,
      reason: "too-many-attempts",
    });

    // And the real code no longer works: hitting the cap deletes the document,
    // so a brute-force run cannot be followed by the correct code.
    expect(await verifyCode(EMAIL, issued.code)).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects an expired code and deletes it", async () => {
    const issued = await issueCode(EMAIL);
    if (!issued.sent) throw new Error("expected a code");

    // 10 minute TTL.
    vi.spyOn(Date, "now").mockReturnValue(issued.expiresAt + 1);

    expect(await verifyCode(EMAIL, issued.code)).toEqual({ ok: false, reason: "expired" });

    vi.restoreAllMocks();
    expect(await verifyCode(EMAIL, issued.code)).toEqual({ ok: false, reason: "invalid" });
  });

  it("does not accept a code issued for a different address", async () => {
    const issued = await issueCode(EMAIL);
    if (!issued.sent) throw new Error("expected a code");

    await issueCode("someone.else@example.com");

    // The hash is bound to the address, so the code cannot be replayed across
    // accounts even though both documents exist.
    expect(await verifyCode("someone.else@example.com", issued.code)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("answers invalid for an address with no code at all", async () => {
    expect(await verifyCode("nobody@example.com", "123456")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("stores only a hash, never the code", async () => {
    const issued = await issueCode(EMAIL);
    if (!issued.sent) throw new Error("expected a code");

    const stored = JSON.stringify(store.snapshot());
    expect(stored).not.toContain(issued.code);
    expect(stored).not.toContain(EMAIL);
  });
});

describe("cooldown", () => {
  it("blocks a resend inside the window and reports the wait", async () => {
    await recordCooldown(EMAIL);

    const state = await checkCooldown(EMAIL);
    expect(state.blocked).toBe(true);
    if (state.blocked) expect(state.retryAfterMs).toBeGreaterThan(0);
  });

  it("does not block an address with no cooldown recorded", async () => {
    expect(await checkCooldown("fresh@example.com")).toEqual({ blocked: false });
  });

  it("survives the verify path, so burning attempts cannot reset the limit", async () => {
    const issued = await issueCode(EMAIL);
    if (!issued.sent) throw new Error("expected a code");

    // Burn the cap, which deletes the code document.
    for (let i = 0; i < 6; i += 1) await verifyCode(EMAIL, "000000");

    // The cooldown lives on its own document and must be untouched. This is
    // the separation that stopped a caller clearing their own rate limit by
    // guessing wrong five times.
    expect((await checkCooldown(EMAIL)).blocked).toBe(true);
  });
});
