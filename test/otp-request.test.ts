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

vi.mock("@/lib/auth/otp", () => ({
  issueCode: (email: string) => issueCode(email),
}));

vi.mock("@/lib/auth/mailer", () => ({
  sendMail: (mail: unknown) => sendMail(mail),
  signInCodeMail: (email: string, code: string) => ({
    to: email,
    subject: `${code} is your TAG Hub verification code`,
    text: code,
  }),
}));

const { POST } = await import("@/app/api/auth/otp/request/route");

function post(body: unknown) {
  return POST(
    new Request("http://localhost:3000/api/auth/otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    await expect(response.json()).resolves.toEqual({
      error: "Could not send a code. Try again.",
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
    getUserByEmail.mockResolvedValue({ uid: "abc" });
    issueCode.mockResolvedValue({
      sent: false,
      reason: "cooldown",
      retryAfterMs: 42_000,
    });

    const response = await post({ email: "samuel@taxadvisorygrowth.net" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      cooldown: true,
      retryAfterSeconds: 42,
    });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("rejects a malformed body and a missing address", async () => {
    const malformed = await POST(
      new Request("http://localhost:3000/api/auth/otp/request", {
        method: "POST",
        body: "not json",
      }) as never,
    );
    expect(malformed.status).toBe(400);

    const missing = await post({ email: "nope" });
    expect(missing.status).toBe(400);
    expect(getUserByEmail).not.toHaveBeenCalled();
  });
});
