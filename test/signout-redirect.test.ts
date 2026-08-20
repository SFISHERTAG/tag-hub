import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Story: signing out sent the browser to `https://0.0.0.0:8080/signin`.
 *
 * Route handlers that build an absolute URL from `request.nextUrl.origin` read
 * the SERVER's bind address, and inside Cloud Run that is HOSTNAME=0.0.0.0 with
 * PORT=8080, not the address the browser used. Confirmed against production
 * before the fix: `POST /api/auth/signout` returned
 * `location: https://0.0.0.0:8080/signin`.
 *
 * A host-relative Location is resolved by the browser against the request it
 * already made. No host detection, no x-forwarded-* parsing, no configured base
 * URL, so it cannot drift per environment.
 *
 * WHAT THESE TESTS CAN AND CANNOT REPRODUCE. Locally, `nextUrl.origin`
 * resolves to the request URL's own origin, so the 0.0.0.0 assertions below
 * pass even on the broken code. They are kept as documentation of the symptom,
 * not as the guard. The assertion that actually catches a regression is that
 * Location is exactly "/signin" and does not start with a scheme: verified by
 * reverting the fix, which fails those two and leaves
 * "https://hub.taxadvisorygrowth.com/signin" in Location.
 *
 * That is the right thing to assert anyway. Relative-versus-absolute is the
 * root cause; 0.0.0.0 is only how it happened to surface in Cloud Run.
 */

const revokeRefreshTokens = vi.fn();
const verifySessionCookie = vi.fn();
vi.mock("@/lib/auth/admin", () => ({
  adminAuth: () => ({ verifySessionCookie, revokeRefreshTokens }),
  SESSION_COOKIE: "hub_session",
  SESSION_MAX_AGE_MS: 1000,
}));

vi.mock("@/lib/auth/session", () => ({
  getImpersonation: async () => null,
  ROLE_COOKIE: "hub_role",
  IMPERSONATION_COOKIE: "hub_impersonation",
}));

vi.mock("@/lib/auth/session-cookie", () => ({
  clearAuthCookies: <T,>(response: T) => response,
}));

vi.mock("@/lib/audit/store", () => ({
  closeImpersonationEntry: vi.fn(),
}));

const { POST } = await import("@/app/api/auth/signout/route");

function request(accept?: string) {
  const headers: Record<string, string> = {};
  if (accept) headers.accept = accept;
  // NextRequest, not Request: the handler reads `request.cookies`, which only
  // exists on the Next wrapper.
  const req = new NextRequest("https://hub.taxadvisorygrowth.com/api/auth/signout", {
    method: "POST",
    headers,
  });
  req.cookies.set("hub_session", "a-session-cookie");
  return req;
}

beforeEach(() => {
  vi.clearAllMocks();
  verifySessionCookie.mockResolvedValue({ sub: "u-1" });
});

describe("POST /api/auth/signout", () => {
  it("redirects to a host-relative path, not an absolute URL", async () => {
    const response = await POST(request());

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/signin");
  });

  it("never emits the container's own bind address", async () => {
    const location = (await POST(request())).headers.get("location") ?? "";

    // The exact production symptom.
    expect(location).not.toContain("0.0.0.0");
    expect(location).not.toContain(":8080");
    expect(location).not.toMatch(/^https?:\/\//);
  });

  it("uses 303 so the browser does not re-POST to /signin", async () => {
    // 307 preserves the method, which would repeat the POST against a page.
    expect((await POST(request())).status).toBe(303);
  });

  it("still answers JSON when the client asks for it", async () => {
    const response = await POST(request("application/json"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
