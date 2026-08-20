import { describe, expect, it, vi, beforeEach } from "vitest";
import { ROLES } from "@/lib/auth/role-labels";

/**
 * Story: this is the second way into the app, so it has to be exactly as hard
 * to abuse as the first.
 *
 * The check that carries the most weight is the audience. `verifyIdToken`
 * validates the signature against Google's keys, but an ID token minted for ANY
 * other Google application is also correctly signed. Without pinning `aud` to
 * our own client id, any such token would be accepted and would sign its bearer
 * in as whoever the email matched.
 */

const verifyIdToken = vi.fn();
vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    verifyIdToken = verifyIdToken;
  },
}));

const getUserByEmail = vi.fn();
vi.mock("@/lib/auth/admin", () => ({
  adminAuth: () => ({ getUserByEmail }),
  SESSION_COOKIE: "hub_session",
  SESSION_MAX_AGE_MS: 1000,
}));

const isGoogleSigninConfigured = vi.fn(() => true);
vi.mock("@/lib/config", () => ({
  config: { googleSigninClientId: "test-client-id.apps.googleusercontent.com", appOrigin: "" },
  isGoogleSigninConfigured: () => isGoogleSigninConfigured(),
}));

const mintSessionCookieForUid = vi.fn(async () => "minted-cookie");
const rejectCrossSite = vi.fn(() => null);
vi.mock("@/lib/auth/session-cookie", async () => {
  const { NextResponse } = await import("next/server");
  return {
    apiError: (message: string, context: string, status: number) =>
      NextResponse.json({ message, context, status }, { status }),
    mintSessionCookieForUid: () => mintSessionCookieForUid(),
    rejectCrossSite: () => rejectCrossSite(),
    setSessionCookie: <T,>(response: T) => response,
  };
});

const resolveSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  resolveSession: (...args: unknown[]) => resolveSession(...args),
  ROLE_COOKIE: "hub_role",
  IMPERSONATION_COOKIE: "hub_impersonation",
}));

vi.mock("@/lib/auth/session-payload", () => ({
  buildSessionPayload: (session: unknown) => session,
}));

const { POST } = await import("@/app/api/auth/google/route");

function request(body: unknown = { credential: "a.b.c" }) {
  return new Request("http://localhost:3000/api/auth/google", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify(body),
  }) as never;
}

function payload(overrides: Record<string, unknown> = {}) {
  return { email: "someone@taxadvisorygrowth.com", email_verified: true, sub: "g-1", ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  isGoogleSigninConfigured.mockReturnValue(true);
  rejectCrossSite.mockReturnValue(null);
  mintSessionCookieForUid.mockResolvedValue("minted-cookie");
  verifyIdToken.mockResolvedValue({ getPayload: () => payload() });
  getUserByEmail.mockResolvedValue({ uid: "u-1" });
  resolveSession.mockResolvedValue({ uid: "u-1", currentRole: ROLES.TAG_CSM });
});

describe("POST /api/auth/google", () => {
  it("pins the audience to our own client id", async () => {
    await POST(request());

    // The check without which any correctly-signed Google ID token, from any
    // application, would be accepted.
    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: "a.b.c",
      audience: "test-client-id.apps.googleusercontent.com",
    });
  });

  it("mints a session for a matched, verified account", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mintSessionCookieForUid).toHaveBeenCalled();
  });

  it("refuses an unverified email address", async () => {
    verifyIdToken.mockResolvedValue({ getPayload: () => payload({ email_verified: false }) });

    const response = await POST(request());

    // A Google account can carry an address the holder never proved they own,
    // and we match users by address.
    expect(response.status).toBe(401);
    expect(mintSessionCookieForUid).not.toHaveBeenCalled();
  });

  it("refuses a payload with no email at all", async () => {
    verifyIdToken.mockResolvedValue({ getPayload: () => payload({ email: undefined }) });

    expect((await POST(request())).status).toBe(401);
  });

  it("refuses a forged or expired credential", async () => {
    verifyIdToken.mockRejectedValue(new Error("Invalid token signature"));

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(mintSessionCookieForUid).not.toHaveBeenCalled();
  });

  it("does not auto-provision an unknown account", async () => {
    getUserByEmail.mockRejectedValue(new Error("not found"));

    const response = await POST(request());

    // No self-signup anywhere in this app. An auto-created user would carry no
    // role grants and would read as signed out immediately after being given a
    // cookie.
    expect(response.status).toBe(401);
    expect(mintSessionCookieForUid).not.toHaveBeenCalled();
  });

  it("gives the same message for an unknown account as for a bad credential", async () => {
    getUserByEmail.mockRejectedValue(new Error("not found"));
    const unknown = await (await POST(request())).json();

    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    isGoogleSigninConfigured.mockReturnValue(true);
    rejectCrossSite.mockReturnValue(null);
    verifyIdToken.mockResolvedValue({ getPayload: () => payload() });
    getUserByEmail.mockResolvedValue({ uid: "u-1" });
    resolveSession.mockResolvedValue(null);
    const noRoles = await (await POST(request())).json();

    // Distinguishing "no such account" from "account exists but has no access"
    // would let anyone probe which addresses are provisioned.
    expect(unknown.status).toBe(401);
    expect(noRoles.status).toBe(403);
  });

  it("503s rather than passing when Google sign-in is not configured", async () => {
    isGoogleSigninConfigured.mockReturnValue(false);

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("rejects a cross-site request before touching the credential", async () => {
    const { NextResponse } = await import("next/server");
    rejectCrossSite.mockReturnValue(
      NextResponse.json({ message: "no", context: "x", status: 403 }, { status: 403 }) as never,
    );

    const response = await POST(request());

    // Login CSRF: an attacker POSTing their own credential would otherwise sign
    // the victim into the attacker's account.
    expect(response.status).toBe(403);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("rejects a request with no credential", async () => {
    expect((await POST(request({}))).status).toBe(400);
  });

  it("does not read a hat from the incoming request", async () => {
    await POST(request());

    // undefined, so the caller lands on their first available role. Reading
    // hub_role here would let a previous user's hat select the view for a
    // session just minted for someone else.
    expect(resolveSession).toHaveBeenCalledWith("minted-cookie", undefined);
  });
});
