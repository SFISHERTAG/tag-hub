import { describe, expect, it, vi, beforeEach } from "vitest";
import { checkWebhookSecret } from "./secret.js";

/**
 * Story: Phase 2/3's caller sends a Bearer token that the handler never
 * reads at all, and Phase 3 doesn't send one yet. This validates it when
 * present, but never blocks the request either way — only warns — since
 * Phase 3's rollout isn't standardized and a hard 401 would break real
 * callers this repo doesn't fully control.
 */

function req(authHeader?: string) {
  return {
    header: (name: string) => (name.toLowerCase() === "authorization" ? authHeader : undefined),
  };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("checkWebhookSecret", () => {
  it("a correct token logs nothing", () => {
    vi.stubEnv("TEST_SECRET", "correct-token");
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    checkWebhookSecret("Phase 2", req("Bearer correct-token"), "TEST_SECRET");

    expect(spy).not.toHaveBeenCalled();
  });

  it("a missing token warns but never throws or signals rejection", () => {
    vi.stubEnv("TEST_SECRET", "correct-token");
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => checkWebhookSecret("Phase 2", req(undefined), "TEST_SECRET")).not.toThrow();

    expect(spy).toHaveBeenCalledWith(expect.stringContaining("No Authorization header"));
  });

  it("a malformed (non-Bearer) token warns", () => {
    vi.stubEnv("TEST_SECRET", "correct-token");
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    checkWebhookSecret("Phase 2", req("Basic dXNlcjpwYXNz"), "TEST_SECRET");

    expect(spy).toHaveBeenCalledWith(expect.stringContaining("not a well-formed Bearer token"));
  });

  it("a wrong token warns", () => {
    vi.stubEnv("TEST_SECRET", "correct-token");
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    checkWebhookSecret("Phase 2", req("Bearer wrong-token"), "TEST_SECRET");

    expect(spy).toHaveBeenCalledWith(expect.stringContaining("did not match"));
  });

  it("a token sent when nothing is configured to check it against warns, distinctly", () => {
    vi.stubEnv("TEST_SECRET", "");
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    checkWebhookSecret("Phase 3", req("Bearer whatever"), "TEST_SECRET");

    expect(spy).toHaveBeenCalledWith(expect.stringContaining("isn't configured here"));
  });
});
