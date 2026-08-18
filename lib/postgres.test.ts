import { describe, expect, it, vi } from "vitest";

/**
 * Story: getFullFramework()'s 30-100+ query waterfall meant concurrent
 * closers could exhaust an unbounded pool during live calls (Phase 2 item
 * 2.5). This asserts the pool is actually constructed with bounds, not just
 * that the code compiles.
 */

type FakePool = { config: unknown; totalCount: number; waitingCount: number; on: ReturnType<typeof vi.fn> };

const PoolConstructor = vi.fn().mockImplementation(function (this: FakePool, config: unknown) {
  this.config = config;
  this.totalCount = 0;
  this.waitingCount = 0;
  this.on = vi.fn();
});

vi.mock("pg", () => ({
  default: { Pool: PoolConstructor },
}));

describe("Postgres pool configuration", () => {
  it("bounds max connections and sets timeouts instead of an unbounded pool", async () => {
    const { getPool } = await import("./postgres");
    getPool();

    expect(PoolConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      }),
    );
  });

  it("logs a warning when a query is queued behind a full pool", async () => {
    const { getPool } = await import("./postgres");
    const pool = getPool() as unknown as {
      totalCount: number;
      waitingCount: number;
      on: ReturnType<typeof vi.fn>;
    };
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    pool.totalCount = 10;
    pool.waitingCount = 3;
    const onConnect = pool.on.mock.calls.find((call: unknown[]) => call[0] === "connect")?.[1];
    onConnect?.();

    expect(spy).toHaveBeenCalledWith(expect.stringContaining("Postgres pool near capacity"));
    spy.mockRestore();
  });
});
