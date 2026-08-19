import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

/**
 * Story: two defects in the same file, both invisible until an Angular SPA
 * tried to use it.
 *
 * 1. Every unauthenticated request got a 307 to /signin, including XHRs. A
 *    fetch() follows that redirect and resolves with a 200 and an HTML sign-in
 *    document, so the caller cannot tell a failed request from a successful
 *    one, and the Angular authInterceptor's refresh-on-401 could never fire.
 *
 * 2. The matcher excluded only Next's own internals, so Angular's build output
 *    (main-<hash>.js, styles-<hash>.css, ngsw-worker.js, manifest.webmanifest)
 *    was auth-gated. A signed-out visitor could not load the JavaScript that
 *    renders the sign-in page they were being redirected to.
 */

const { proxy, config } = await import("@/proxy");

function request(path: string, { cookie = false, method = "GET" } = {}) {
  const req = new NextRequest(new URL(path, "http://localhost:3000"), { method });
  if (cookie) req.cookies.set("hub_session", "any-value");
  return req;
}

/** Reproduces how Next applies `config.matcher` to decide whether proxy runs. */
function matches(path: string): boolean {
  return config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(path));
}

describe("api requests", () => {
  it("returns 401 with an ApiError body, not a redirect", async () => {
    const response = proxy(request("/api/dashboard/widgets"));

    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();

    const body = await response.json();
    expect(body).toEqual({
      message: "Not signed in",
      context: "GET /api/dashboard/widgets",
      status: 401,
    });
  });

  it("names the actual method in the error context", async () => {
    const response = proxy(request("/api/dashboard/config", { method: "POST" }));
    const body = await response.json();

    expect(body.context).toBe("POST /api/dashboard/config");
  });

  it("lets the auth endpoints through unauthenticated", () => {
    // Establishing a session necessarily happens without one.
    expect(proxy(request("/api/auth/session")).status).toBe(200);
    expect(proxy(request("/api/oauth/callback")).status).toBe(200);
  });

  it("lets an authenticated api request through", () => {
    expect(proxy(request("/api/dashboard/widgets", { cookie: true })).status).toBe(200);
  });
});

describe("page requests", () => {
  it("still redirects a signed-out visitor to sign-in", () => {
    const response = proxy(request("/dashboard"));

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/signin");
    expect(location).toContain("next=%2Fdashboard");
  });

  it("does not append a next param for the root path", () => {
    const location = proxy(request("/")).headers.get("location");

    expect(location).toContain("/signin");
    expect(location).not.toContain("next=");
  });

  it("lets an authenticated visitor through", () => {
    expect(proxy(request("/dashboard", { cookie: true })).status).toBe(200);
  });
});

describe("matcher", () => {
  it("does not gate Angular's build output", () => {
    // Hashed bundle names are what an Angular production build actually emits.
    expect(matches("/main-PAE6IEKE.js")).toBe(false);
    expect(matches("/styles-ZFMQ2QIB.css")).toBe(false);
    expect(matches("/main-PAE6IEKE.js.map")).toBe(false);
  });

  it("does not gate the service worker or the web manifest", () => {
    // ngsw-worker.js is fetched by the browser with no cookie in some contexts;
    // a 307 to /signin here silently breaks the PWA install path.
    expect(matches("/ngsw-worker.js")).toBe(false);
    expect(matches("/ngsw.json")).toBe(false);
    expect(matches("/manifest.webmanifest")).toBe(false);
  });

  it("still gates real pages and api routes", () => {
    expect(matches("/dashboard")).toBe(true);
    expect(matches("/api/dashboard/widgets")).toBe(true);
    expect(matches("/l/loc1/pipeline")).toBe(true);
  });

  it("still skips Next internals", () => {
    expect(matches("/_next/static/chunk.js")).toBe(false);
    expect(matches("/favicon.ico")).toBe(false);
  });
});
