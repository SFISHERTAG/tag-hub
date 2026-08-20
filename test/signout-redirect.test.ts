import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Guards the redirect target, which is the part of sign-out that broke in
 * production and cannot be caught locally: `request.nextUrl.origin` is the
 * container's own bind address inside Cloud Run, so an absolute redirect built
 * from it pointed at `https://0.0.0.0:8080/signin`. A relative Location has no
 * host to get wrong, so the assertion here is that one is emitted.
 */

const verifySessionCookie = vi.fn();
const revokeRefreshTokens = vi.fn();

vi.mock("@/lib/auth/admin", () => ({
  adminAuth: () => ({ verifySessionCookie, revokeRefreshTokens }),
  SESSION_COOKIE: "session",
}));

const { POST } = await import("@/app/api/auth/signout/route");

/**
 * The host here is deliberately the bind address Cloud Run reports, so a
 * regression that reintroduces an origin-derived URL fails rather than passing
 * against a friendly localhost.
 */
function signOut() {
  return POST(new NextRequest("https://0.0.0.0:8080/api/auth/signout", { method: "POST" }));
}

describe("POST /api/auth/signout", () => {
  it("redirects to a host-relative sign-in path, never the container's own address", async () => {
    const response = await signOut();
    const location = response.headers.get("location");

    expect(location).toBe("/signin");
    expect(location).not.toContain("0.0.0.0");
  });

  it("uses 303 so the redirected request is a GET rather than a repeated POST", async () => {
    const response = await signOut();
    expect(response.status).toBe(303);
  });

  it("clears the session cookie", async () => {
    const response = await signOut();
    expect(response.headers.get("set-cookie")).toMatch(/session=;/);
  });
});
