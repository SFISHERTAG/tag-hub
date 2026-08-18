import pg from "pg";

const { Pool } = pg;

/**
 * Postgres connection pool for accessing automation logs.
 * Points to the same tag_automation database as /functions.
 */

let poolInstance: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!poolInstance) {
    poolInstance = new Pool({
      user: process.env.DB_USER || "tag_app_user",
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME || "tag_automation",
    });

    poolInstance.on("error", (err: Error) => {
      console.error("Postgres pool error:", err);
    });
  }

  return poolInstance;
}

export { getPool };

export const pool = getPool();
