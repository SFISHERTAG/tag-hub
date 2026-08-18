import "server-only";
import { getOpportunities, type Opportunity } from "./opportunities";
import { getPipelines } from "./pipelines";
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
  /** Pre-call vs on-call DQ counts — see docs/stories/6.4. */
  dqBreakdown?: { preCall: number; onCall: number };
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
 * Close rate is still an open signal from story 3.2 — no closed-opportunity
 * data flows into this function. DQ rate now splits per story 6.4: a
 * pre-call DQ (nobody showed, bad targeting) drops out of the show-rate
 * denominator entirely, while an on-call DQ (someone showed, wrong fit)
 * stays in the denominator but is never counted as "showed" itself.
 *
 * Appointments with no outcome record (Firestore write lost, or predates
 * story 2.3) have unknown timing. Per the story's dev notes that's treated
 * conservatively: kept in the denominator rather than dropped, so a missing
 * record can only ever lower the show rate, never inflate it.
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
  let preCallDq = 0;
  let onCallDq = 0;

  for (const appointmentId of appointmentIds) {
    booked++;
    const outcome = outcomes.get(appointmentId);
    if (!outcome) continue; // timing unknown — stays in denominator, counted as neither showed nor DQ

    if (outcome.status === "showed") {
      showed++;
    } else if (outcome.status === "invalid") {
      if (outcome.timing === "pre-call") {
        preCallDq++;
      } else {
        onCallDq++;
      }
    }
  }

  const showRateDenominator = booked - preCallDq;
  const showRate = showRateDenominator > 0 ? showed / showRateDenominator : 0;
  const showRatePct = Math.round(showRate * 100);

  const evaluation = evaluateRules(clientHealthRules, { showRatePct });

  return {
    status: evaluation.bucket as ClientHealth["status"],
    showRate: showRatePct,
    reason: evaluation.matchedRuleLabel ?? undefined,
    dqBreakdown: { preCall: preCallDq, onCall: onCallDq },
  };
}

export type FulfillmentOpportunity = {
  opportunity: Opportunity;
  pipelineId: string;
  /** Resolved GHL stage name, e.g. "PR1" — opportunity.pipelineStageId is an opaque id. */
  stageName: string | null;
};

/**
 * The client's Fulfillment opportunity, with its stage id resolved to a name
 * (PR1-AP5). The Fulfillment pipeline is looked up by name rather than a
 * per-tenant id — no tenant field carries one, and GHL pipeline ids are
 * stable per location once created.
 */
export async function getFulfillmentOpportunity(
  locationId: string,
): Promise<FulfillmentOpportunity | null> {
  const pipelines = await getPipelines(locationId);
  const fulfillment = pipelines.find(
    (pipeline) => pipeline.name.trim().toLowerCase() === "fulfillment",
  );
  if (!fulfillment) return null;

  const opportunities = await getOpportunities(locationId, fulfillment.id, {
    status: "all",
    limit: 1,
  });
  const opportunity = opportunities[0];
  if (!opportunity) return null;

  const stageName =
    fulfillment.stages.find((stage) => stage.id === opportunity.pipelineStageId)?.name ?? null;

  return { opportunity, pipelineId: fulfillment.id, stageName };
}
