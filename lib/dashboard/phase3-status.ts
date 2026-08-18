import "server-only";
import { pool } from "@/lib/postgres";

/**
 * Phase 3 status for a client from automation logs.
 * Tracks Meta account setup progress.
 */
export interface Phase3Status {
  locationId: string;
  phase: string;
  event: string;
  hasMetaAccount: boolean;
  accessRequested: boolean;
  setupGuideSent: boolean;
  errorMessage?: string;
  createdAt: string;
}

export interface Phase3Progress {
  locationId: string;
  status: "pending" | "in_progress" | "meta_access_requested" | "setup_guide_sent" | "complete" | "error";
  hasMetaAccount?: boolean;
  lastEvent?: string;
  lastEventTime?: string;
  errorMessage?: string;
}

/**
 * Get Phase 3 status for a client from Postgres automation logs.
 * Returns the latest Phase 3 event and its status.
 */
export async function getPhase3Status(locationId: string): Promise<Phase3Progress | null> {
  try {
    const result = await pool.query(
      `
      SELECT
        location_id,
        phase,
        event,
        details,
        created_at
      FROM automation_logs
      WHERE location_id = $1 AND phase = 'phase3'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [locationId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const details = row.details || {};

    // Determine status from event
    let status: Phase3Progress["status"] = "pending";
    if (row.event === "phase3_error") {
      status = "error";
    } else if (row.event === "meta_account_check") {
      status = "in_progress";
    } else if (row.event === "meta_access_request_sent") {
      status = "meta_access_requested";
    } else if (row.event === "meta_setup_guide_sent") {
      status = "setup_guide_sent";
    } else if (row.event === "phase3_complete") {
      status = "complete";
    }

    return {
      locationId,
      status,
      hasMetaAccount: details.has_existing_account,
      lastEvent: row.event,
      lastEventTime: row.created_at,
      errorMessage: details.error,
    };
  } catch (error) {
    console.error("Error fetching Phase 3 status:", error);
    return null;
  }
}

/**
 * Get all Phase 3 events for a client (full audit trail).
 */
export async function getPhase3History(locationId: string): Promise<Phase3Status[]> {
  try {
    const result = await pool.query(
      `
      SELECT
        location_id,
        phase,
        event,
        details,
        created_at
      FROM automation_logs
      WHERE location_id = $1 AND phase = 'phase3'
      ORDER BY created_at ASC
      `,
      [locationId]
    );

    return result.rows.map((row: Record<string, any>) => ({
      locationId: row.location_id,
      phase: row.phase,
      event: row.event,
      hasMetaAccount: row.details?.has_existing_account || false,
      accessRequested: row.event === "meta_access_request_sent",
      setupGuideSent: row.event === "meta_setup_guide_sent",
      errorMessage: row.details?.error,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error("Error fetching Phase 3 history:", error);
    return [];
  }
}
