import { Pool, QueryResult } from "pg";

/**
 * Postgres logging for all automation phases.
 * Logs all events, errors, and state changes to database.
 */

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME || "tag_automation",
    });

    pool.on("error", (err) => {
      console.error("[Postgres] Unexpected connection error:", err);
      process.exitCode = 1;
    });
  }

  return pool;
}

export interface AutomationLog {
  locationId: string;
  phase: "phase1" | "phase2" | "phase3";
  event: string;
  status: "started" | "in_progress" | "completed" | "error";
  details?: Record<string, unknown>;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log automation event to Postgres.
 */
export async function logAutomationEvent(log: AutomationLog): Promise<void> {
  try {
    const pool = getPool();

    const query = `
      INSERT INTO automation_logs
        (location_id, phase, event, status, details, error, metadata, created_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id
    `;

    const values = [
      log.locationId,
      log.phase,
      log.event,
      log.status,
      log.details ? JSON.stringify(log.details) : null,
      log.error || null,
      log.metadata ? JSON.stringify(log.metadata) : null,
    ];

    const result: QueryResult = await pool.query(query, values);
    console.log(`[Postgres] Logged event: ${log.event} (ID: ${result.rows[0].id})`);
  } catch (error) {
    console.error("[Postgres] Failed to log event:", error);
    // Don't throw - logging failures shouldn't block automation
  }
}

/**
 * Log client meta account setup to Postgres.
 */
export async function logMetaSetup(locationId: string, data: {
  status: "awaiting_access_grant" | "awaiting_account_creation" | "completed";
  metaAdAccountId?: string;
  metaBusinessId?: string;
  error?: string;
}): Promise<void> {
  await logAutomationEvent({
    locationId,
    phase: "phase3",
    event: "meta_setup",
    status: data.error ? "error" : "completed",
    details: {
      metaAdAccountId: data.metaAdAccountId,
      metaBusinessId: data.metaBusinessId,
      status: data.status,
    },
    error: data.error,
  });
}

/**
 * Get automation history for a client.
 */
export async function getAutomationHistory(locationId: string): Promise<AutomationLog[]> {
  try {
    const pool = getPool();

    const query = `
      SELECT location_id, phase, event, status, details, error, metadata
      FROM automation_logs
      WHERE location_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `;

    const result = await pool.query(query, [locationId]);

    return result.rows.map((row) => ({
      locationId: row.location_id,
      phase: row.phase,
      event: row.event,
      status: row.status,
      details: row.details ? JSON.parse(row.details) : undefined,
      error: row.error,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  } catch (error) {
    console.error("[Postgres] Failed to fetch history:", error);
    return [];
  }
}

/**
 * Close Postgres pool (for graceful shutdown).
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
