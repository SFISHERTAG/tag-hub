import { describe, expect, it, vi } from "vitest";
import { withErrorHandling, ok, fail } from "./errorInterceptor";

describe("errorInterceptor", () => {
  it("ok() wraps a value with no error", () => {
    expect(ok([1, 2, 3])).toEqual({ data: [1, 2, 3], error: null });
  });

  it("withErrorHandling returns data on success", async () => {
    const result = await withErrorHandling("test", async () => ["a", "b"]);
    expect(result).toEqual({ data: ["a", "b"], error: null });
  });

  it("a network timeout becomes an error object, not an empty array", async () => {
    const timeout = new Error("ETIMEDOUT");
    const result = await withErrorHandling<string[]>("fetchThing", async () => {
      throw timeout;
    });

    expect(result.error).not.toBeNull();
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("ETIMEDOUT");
    expect(result.error?.context).toBe("fetchThing");
    // Specifically not the old silent-catch shape.
    expect(result).not.toEqual({ data: [], error: null });
  });

  it("a 403 becomes an error, not null", async () => {
    const forbidden = Object.assign(new Error("Forbidden"), { status: 403 });
    const result = await withErrorHandling<{ id: string } | null>("getThing", async () => {
      throw forbidden;
    });

    expect(result.error).not.toBeNull();
    expect(result.error?.status).toBe(403);
    expect(result.data).toBeNull();
    // The old code returned `null` for this case too — the point of this
    // type is that `null` now only ever means "no error, genuinely nothing
    // there," and callers can no longer conflate the two.
    expect(result.error).not.toBeUndefined();
  });

  it("logs the failure with its context", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await withErrorHandling("myContext", async () => {
      throw new Error("boom");
    });
    expect(spy).toHaveBeenCalledWith("[myContext]", expect.any(Error));
    spy.mockRestore();
  });

  it("fail() extracts a numeric status when the cause carries one", () => {
    const result = fail("ctx", { status: 429, message: "rate limited" });
    expect(result.error?.status).toBe(429);
  });

  it("fail() omits status when the cause carries none", () => {
    const result = fail("ctx", new Error("plain failure"));
    expect(result.error?.status).toBeUndefined();
  });
});
