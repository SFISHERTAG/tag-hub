import "server-only";
import { ghl } from "./client";

/**
 * A stage on an opportunity pipeline.
 *
 * Named `PipelineStage` rather than `Stage` because this codebase has three
 * unrelated things called a stage — the opportunity pipeline stage here, the
 * Fulfillment stage (PR1–AP5) that drives onboarding, and the lifecycle stage
 * on a client record. A bare `Stage` import gives no clue which one arrived,
 * and the two call sites were already reaching for this longer name.
 */
export type PipelineStage = {
  id: string;
  name: string;
  position: number;
};

export type Pipeline = {
  id: string;
  name: string;
  stages: PipelineStage[];
};

export async function getPipelines(locationId: string): Promise<Pipeline[]> {
  const data = await ghl<{ pipelines?: Pipeline[] }>(
    locationId,
    "/opportunities/pipelines",
    {
      searchParams: { locationId },
      revalidate: 300, // pipelines change rarely
    },
  );

  return (data.pipelines ?? []).map((pipeline) => ({
    ...pipeline,
    stages: [...(pipeline.stages ?? [])].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0),
    ),
  }));
}

/**
 * Finds a stage id by exact name across all of a location's pipelines.
 * Stage ids are GHL-generated and not known ahead of time (see the
 * `PipelineStage` note above on Fulfillment stages), so callers that need to
 * target a stage by its human name — e.g. Story 5.5's "AP 2 - Ads Launched"
 * — resolve it here rather than hardcoding an id.
 */
export async function findStageId(locationId: string, stageName: string): Promise<string | null> {
  const pipelines = await getPipelines(locationId);
  for (const pipeline of pipelines) {
    const stage = pipeline.stages.find((s) => s.name === stageName);
    if (stage) return stage.id;
  }
  return null;
}
