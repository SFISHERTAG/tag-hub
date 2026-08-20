import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Covers the distinction the request route exists to make: an unknown address
 * is answered with success so the endpoint cannot be used to enumerate
 * accounts, while a failure of ours is answered with a 500 so it cannot be
 * mistaken for a delivered code.
 */

const getUserByEmail = vi.fn();
const issueCode = vi.fn();
const sendMail = vi.fn();

vi.mock("@/lib/auth/admin", () => ({
  adminAuth: () => ({ getUserByEmail }),
}));

const checkCooldown = vi.fn();
const recordCooldown = vi.fn();

vi.mock("@/lib/auth/otp", () => ({
  issueCode: (email: string) => issueCode(email),
  checkCooldown: (email: string) => checkCooldown(email),
  recordCooldown: (email: string) => recordCooldown(email),
}));

vi.mock("@/lib/auth/mailer", () => ({
  sendMail: (mail: unknown) => sendMail(mail),
  signInCodeMail: (email: string, code: string) => ({
    to: email,
    subject: `${code} is your TAG Hub sign-in code`,
    text: code,
  }),
}));

const { POST } = await import("@/app/api/auth/otp/request/route");

/**
 * Same-origin by default. The route now refuses cross-site requests, so every
 * ordinary case has to look like a real browser fetch: JSON content type plus an
 * Origin matching the host.
 */
function post(body: unknown, { origin = "http://localhost:3000" }: { origin?: string | null } = {}) {
  const headers = new Headers({
    "Content-Type": "application/json",
    host: "localhost:3000",
  });
  if (origin !== null) headers.set("origin", origin);

  return POST(
    new Request("http://localhost:3000/api/auth/otp/request", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }) as never,
  );
}

/** Shaped like a FirebaseAuthError, which carries the code on the error. */
function authError(code: string) {
  return Object.assign(new Error(code), { code });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Not in cooldown unless a test says so.
  checkCooldown.mockResolvedValue({ blocked: false });
  recordCooldown.mockResolvedValue(undefined);
});

describe("POST /api/auth/otp/request", () => {
  it("issues and sends a code for a known address", async () => {
    getUserByEmail.mockResolvedValue({ uid: "abc" });
    issueCode.mockResolvedValue({
      sent: true,
      code: "123456",
      expiresAt: Date.now() + 600_000,
    });
    sendMail.mockResolvedValue(undefined);

    const response = await post({ email: "samuel@taxadvisorygrowth.net" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(sendMail).toHaveBeenCalledOnce();
    expect(sendMail.mock.calls[0][0]).toMatchObject({
      to: "samuel@taxadvisorygrowth.net",
      text: "123456",
    });
  });

  it("reports success for an unknown address without issuing anything", async () => {
    getUserByEmail.mockRejectedValue(authError("auth/user-not-found"));

    const response = await post({ email: "stranger@example.com" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(issueCode).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  /**
   * The regression this file was written for. A 403 from credentials without a
   * quota project surfaces as `auth/internal-error`, and returning `ok` for it
   * made a dead sign-in flow look healthy.
   */
  it("fails with a 500 when the lookup itself is broken", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    getUserByEmail.mockRejectedValue(authError("auth/internal-error"));

    const response = await post({ email: "samuel@taxadvisorygrowth.net" });

    expect(response.status).toBe(500);
    // ApiError now, not { error }: the Angular interceptor reads `message`.
    await expect(response.json()).resolves.toMatchObject({
      message: "Could not send a code. Try again.",
      status: 500,
    });
    expect(issueCode).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("does not distinguish existing from unknown addresses on success", async () => {
    getUserByEmail.mockResolvedValue({ uid: "abc" });
    issueCode.mockResolvedValue({
      sent: true,
      code: "123456",
      expiresAt: Date.now() + 600_000,
    });
    sendMail.mockResolvedValue(undefined);
    const known = await post({ email: "samuel@taxadvisorygrowth.net" });
    const knownBody = await known.json();

    vi.clearAllMocks();
    getUserByEmail.mockRejectedValue(authError("auth/user-not-found"));
    const unknown = await post({ email: "stranger@example.com" });
    const unknownBody = await unknown.json();

    expect(known.status).toBe(unknown.status);
    expect(knownBody).toEqual(unknownBody);
  });

  it("passes the cooldown through instead of sending twice", async () => {
    checkCooldown.mockResolvedValue({ blocked: true, retryAfterMs: 42_000 });

    const response = await post({ email: "samuel@taxadvisorygrowth.net" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      cooldown: true,
      retryAfterSeconds: 42,
    });
    expect(sendMail).not.toHaveBeenCalled();
  });

  /**
   * The cooldown used to be checked only after a successful user lookup, so
   * `cooldown: true` was reachable only for an address that had an account.
   * Submitting any address twice inside the window therefore revealed whether it
   * existed — the exact oracle the rest of this route avoids.
   */
  it("does not distinguish existing from unknown addresses while in cooldown", async () => {
    checkCooldown.mockResolvedValue({ blocked: true, retryAfterMs: 30_000 });

    getUserByEmail.mockResolvedValue({ uid: "abc" });
    const known = await post({ email: "samuel@taxadvisorygrowth.net" });
    const knownBody = await known.json();

    getUserByEmail.mockRejectedValue(authError("auth/user-not-found"));
    const unknown = await post({ email: "stranger@example.com" });
    const unknownBody = await unknown.json();

    expect(known.status).toBe(unknown.status);
    expect(knownBody).toEqual(unknownBody);
    // Reached before the lookup, so existence never enters the decision.
    expect(getUserByEmail).not.toHaveBeenCalled();
  });

  it("starts the cooldown for an unknown address too", async () => {
    getUserByEmail.mockRejectedValue(authError("auth/user-not-found"));

    await post({ email: "stranger@example.com" });

    // Otherwise an unknown address never enters cooldown, and so never produces
    // the cooldown response, restoring the oracle from the other direction.
    expect(recordCooldown).toHaveBeenCalledWith("stranger@example.com");
  });

  it("refuses a cross-site request", async () => {
    const response = await post(
      { email: "samuel@taxadvisorygrowth.net" },
      { origin: "https://evil.example.com" },
    );

    expect(response.status).toBe(403);
    expect(getUserByEmail).not.toHaveBeenCalled();
  });

  it("rejects a malformed body and a missing address", async () => {
    const malformed = await POST(
      new Request("http://localhost:3000/api/auth/otp/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          host: "localhost:3000",
          origin: "http://localhost:3000",
        },
        body: "not json",
      }) as never,
    );
    expect(malformed.status).toBe(400);

    const missing = await post({ email: "nope" });
    expect(missing.status).toBe(400);
    expect(getUserByEmail).not.toHaveBeenCalled();
  });
});
