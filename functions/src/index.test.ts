import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

/**
 * Story: this error handler had a 3-arg (err, req, res) signature. Express
 * recognizes error-handling middleware purely by `fn.length === 4` — a
 * 3-arg handler is registered as ordinary middleware instead, so Express
 * never routes a thrown error to it at all, and falls back to its own
 * default (unstyled, stack-trace-leaking) error page instead of this
 * handler's clean `{ error: "..." }` 500.
 */

vi.stubEnv("NODE_ENV", "production"); // skip index.ts's own app.listen() side effect

const { errorHandler } = await import("./index.js");

describe("errorHandler arity", () => {
  it("declares exactly 4 parameters, which is what Express checks to recognize error middleware", () => {
    expect(errorHandler.length).toBe(4);
  });
});

describe("Express actually routes a thrown error to this handler", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    // A fresh app, not the module's own `app` — that one already has
    // errorHandler mounted at import time, and Express only routes an
    // error to error middleware registered AFTER the failing route in the
    // stack, so a route added post-hoc to the real app would never reach
    // it. This still exercises the real exported errorHandler function.
    const testApp = express();
    testApp.get("/throws", () => {
      throw new Error("boom");
    });
    testApp.use(errorHandler);

    await new Promise<void>((resolve) => {
      server = testApp.listen(0, () => {
        const { port } = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(() => {
    server?.close();
  });

  it("returns a clean 500 JSON response instead of crashing or leaking a default error page", async () => {
    const res = await fetch(`${baseUrl}/throws`);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Internal server error" });
  });
});
