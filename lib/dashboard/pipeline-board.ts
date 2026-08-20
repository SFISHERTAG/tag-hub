import "server-only";
import { getPipelines } from "@/lib/ghl/pipelines";
import { getOpportunities, groupByStage } from "@/lib/ghl/opportunities";
import { GhlConfigError, LocationNotAuthorizedError } from "@/lib/ghl/tokens";

export type PipelineStageRollup = { id: string; name: string; count: number; value: number };

export type PipelineBoardResult =
  | { ok: true; pipelineName: string; stages: PipelineStageRollup[] }
  | { ok: false; message: string };

/**
 * Stage-level rollup of the first open pipeline for the dashboard widget.
 *
 * A full drag-and-drop kanban board (see app/page.tsx) doesn't fit a widget
 * cell — this is deliberately the funnel-table treatment applied to real
 * opportunity data: counts and value per stage, not individual cards.
 *
 * locationId is the caller's responsibility to resolve (see
 * lib/dashboard/location-selection.ts#getLocationForDashboard) and must
 * already be checked against the caller's session — this function has no
 * way to know who's asking.
 */
export async function getPipelineBoardSummary(locationId: string): Promise<PipelineBoardResult> {
  if (!locationId) {
    return { ok: false, message: "No GHL location configured yet." };
  }

  try {
    const pipelines = await getPipelines(locationId);
    const pipeline = pipelines[0];
    if (!pipeline) {
      return { ok: false, message: "No pipeline found for this location." };
    }

    const opportunities = await getOpportunities(locationId, pipeline.id, { status: "open" });
    const byStage = groupByStage(opportunities);

    const stages = pipeline.stages.map((stage) => {
      const items = byStage.get(stage.id) ?? [];
      return {
        id: stage.id,
        name: stage.name,
        count: items.length,
        value: items.reduce((sum, o) => sum + (o.monetaryValue || 0), 0),
      };
    });

    return { ok: true, pipelineName: pipeline.name, stages };
  } catch (error) {
    if (error instanceof GhlConfigError || error instanceof LocationNotAuthorizedError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
