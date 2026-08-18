import pg from "pg";

const { Pool } = pg;

/**
 * Postgres connection pool for accessing automation logs.
 * Points to the same tag_automation database as /functions.
 *
 * Bounded per Phase 2 item 2.5: `getFullFramework()`'s per-load query
 * waterfall (30-100+ serial queries) meant concurrent closers loading FLOW
 * during live calls could exhaust an unbounded pool. `max: 10` caps
 * concurrent connections; `connectionTimeoutMillis` fails fast with a clear
 * error instead of a request hanging indefinitely when the pool is
 * saturated; `idleTimeoutMillis` releases connections back rather than
 * holding them open between bursts of activity.
 */
const POOL_MAX = 10;

let poolInstance: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!poolInstance) {
    poolInstance = new Pool({
      user: process.env.DB_USER || "tag_app_user",
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME || "tag_automation",
      max: POOL_MAX,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    poolInstance.on("error", (err: Error) => {
      console.error("Postgres pool error:", err);
    });

    poolInstance.on("connect", () => {
      const pool = poolInstance!;
      // waitingCount > 0 means every connection is checked out and a caller
      // is queued behind this one — the earliest visible sign of the pool
      // running out of headroom, before requests start timing out.
      if (pool.waitingCount > 0) {
        console.warn(
          `Postgres pool near capacity: ${pool.totalCount}/${POOL_MAX} connections in use, ${pool.waitingCount} query(ies) waiting.`,
        );
      }
    });
  }

  return poolInstance;
}

export { getPool };

export const pool = getPool();
