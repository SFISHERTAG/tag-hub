import "server-only";
import { getOpportunities } from "./opportunities";
import { loadAppointmentOutcomes } from "./store";
import { evaluateRules } from "@/lib/rules/engine";
import { clientHealthRules } from "@/lib/rules/configs/clientHealth.config";

/**
 * Client health status.
 * Thresholds live in lib/rules/configs/clientHealth.config.ts, not here.
 * That closes the former "make thresholds dynamically configurable" TODO —
 * changing a number, or adding a delivery-stall / DQ-rate / close-rate rule,
 * is a config edit, not a code change.
 */
export type ClientHealth = {
  status: "healthy" | "at-risk" | "critical";
  showRate?: number;
  reason?: string;
};

/**
 * CSM's portfolio entry.
 */
export type PortfolioClient = {
  locationId: string;
  name: string;
  stage: string;
  health: ClientHealth;
};

/**
 * Get client health based on recent outcomes.
 *
 * Thresholds are evaluated by lib/rules/engine.ts against
 * clientHealthRules — see that config for the current numbers.
 * DQ rate and close rate are still open signals from story 3.2; the outcome
 * breakdown below only tracks show/booked today. Add a dqRatePct / closeRatePct
 * field to the snapshot below and a matching rule to the config once that
 * data is worth acting on — no change needed here or in the engine.
 */
export async function getClientHealth(
  locationId: string,
  appointmentIds: string[],
): Promise<ClientHealth> {
  if (appointmentIds.length === 0) {
    return { status: "healthy", reason: "No recent activity" };
  }

  const outcomes = await loadAppointmentOutcomes(locationId, appointmentIds);

  let showed = 0;
  let booked = 0;

  for (const outcome of outcomes.values()) {
    if (outcome.status === "showed") showed++;
    booked++;
  }

  const showRate = booked > 0 ? showed / booked : 0;
  const showRatePct = Math.round(showRate * 100);

  const evaluation = evaluateRules(clientHealthRules, { showRatePct });

  return {
    status: evaluation.bucket as ClientHealth["status"],
    showRate: showRatePct,
    reason: evaluation.matchedRuleLabel ?? undefined,
  };
}

/**
 * Get Fulfillment opportunity for a location.
 * TODO: determine if fulfillment pipeline ID is hardcoded or varies by location.
 */
export async function getFulfillmentStage(
  locationId: string,
  fulfillmentPipelineId: string,
): Promise<string | null> {
  const opportunities = await getOpportunities(
    locationId,
    fulfillmentPipelineId,
    { status: "all", limit: 1 },
  );

  return opportunities[0]?.name ?? null;
}
