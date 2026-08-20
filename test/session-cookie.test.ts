import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Story: this repo had no CSRF machinery of any kind. A grep for
 * origin/Sec-Fetch/csrf/xsrf across proxy.ts, app/api, lib/auth and lib/api
 * returned nothing but URL construction.
 *
 * With hub_session set SameSite=lax, classic CSRF against an authenticated
 * action is limited, because a cross-site POST does not carry the victim's
 * cookie. The live risk runs the other way: LOGIN CSRF. An attacker's page posts
 * their own credential to a session-minting endpoint, the browser stores the
 * resulting cookie, and the victim is silently signed in as the attacker. Every
 * subsequent action then lands in the attacker's account.
 *
 * Story 10.2 adds two more session-minting endpoints, so the check goes in
 * first, shared, with these tests holding it in place.
 */

vi.mock("@/lib/config", () => ({
  config: { firebaseApiKey: "test-key", appOrigin: "", googleSigninClientId: "" },
  isGoogleSigninConfigured: () => false,
}));

const { rejectCrossSite, apiError } = await import("@/lib/auth/session-cookie");

const CONTEXT = "POST /api/test";

function request({
  origin,
  host = "hub.example.com",
  contentType = "application/json",
}: {
  origin?: string;
  host?: string;
  contentType?: string | null;
} = {}) {
  const headers = new Headers({ host });
  if (origin !== undefined) headers.set("origin", origin);
  if (contentType !== null) headers.set("content-type", contentType);
  return new NextRequest(new URL("https://hub.example.com/api/test"), {
    method: "POST",
    headers,
  });
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("rejectCrossSite", () => {
  it("accepts a same-origin JSON request", () => {
    expect(rejectCrossSite(request({ origin: "https://hub.example.com" }), CONTEXT)).toBeNull();
  });

  it("refuses an origin from another site", async () => {
    const result = rejectCrossSite(request({ origin: "https://evil.example.com" }), CONTEXT);

    expect(result?.status).toBe(403);
    const body = await result?.json();
    expect(body.message).toBe("Cross-site request refused.");
  });

  it("refuses a request with no Origin at all", () => {
    // A cross-site HTML form post omits Origin in some browsers, and a
    // same-origin fetch always sends one on a POST.
    expect(rejectCrossSite(request({ origin: undefined }), CONTEXT)?.status).toBe(403);
  });

  it("refuses a form-encoded body even from the right origin", () => {
    // The check that actually blocks the no-JS attack: an HTML form cannot set
    // custom headers, so it cannot claim application/json cross-site. Without
    // this, request.json() would happily parse the body anyway.
    const result = rejectCrossSite(
      request({ origin: "https://hub.example.com", contentType: "application/x-www-form-urlencoded" }),
      CONTEXT,
    );

    expect(result?.status).toBe(415);
  });

  it("refuses a multipart body, the other form encoding", () => {
    expect(
      rejectCrossSite(
        request({ origin: "https://hub.example.com", contentType: "multipart/form-data" }),
        CONTEXT,
      )?.status,
    ).toBe(415);
  });

  it("refuses a request with no Content-Type", () => {
    expect(
      rejectCrossSite(request({ origin: "https://hub.example.com", contentType: null }), CONTEXT)
        ?.status,
    ).toBe(415);
  });

  it("accepts application/json with a charset parameter", () => {
    expect(
      rejectCrossSite(
        request({ origin: "https://hub.example.com", contentType: "application/json; charset=utf-8" }),
        CONTEXT,
      ),
    ).toBeNull();
  });

  it("refuses a malformed Origin rather than throwing", () => {
    expect(rejectCrossSite(request({ origin: "not a url" }), CONTEXT)?.status).toBe(403);
  });

  it("compares hosts, so a protocol mismatch behind a proxy still passes", () => {
    // Cloud Run terminates TLS: the browser sends https, the container sees
    // http. Comparing full origins would reject every real request.
    expect(
      rejectCrossSite(request({ origin: "http://hub.example.com", host: "hub.example.com" }), CONTEXT),
    ).toBeNull();
  });

  it("treats a different port as a different site", () => {
    expect(
      rejectCrossSite(
        request({ origin: "https://hub.example.com:8443", host: "hub.example.com" }),
        CONTEXT,
      )?.status,
    ).toBe(403);
  });

  it("accepts the ng serve proxy pairing, which keeps the original host", () => {
    // proxy.conf.json forwards :4200 to :3000 with changeOrigin false, so Origin
    // and Host both stay localhost:4200.
    expect(
      rejectCrossSite(
        request({ origin: "http://localhost:4200", host: "localhost:4200" }),
        CONTEXT,
      ),
    ).toBeNull();
  });
});

describe("apiError", () => {
  it("returns an ApiError body the Angular interceptor can read", async () => {
    const response = apiError("Nope", CONTEXT, 401);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "Nope", context: CONTEXT, status: 401 });
  });

  it("marks auth responses no-store", () => {
    // force-dynamic stops Next caching the render, not a browser or an
    // intermediary caching the body.
    expect(apiError("Nope", CONTEXT, 401).headers.get("cache-control")).toBe("no-store");
  });
});
