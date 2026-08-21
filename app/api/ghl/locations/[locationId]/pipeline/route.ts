import "server-only";
import type { NextRequest } from "next/server";
import { getPipelines, type PipelineStage } from "@/lib/ghl/pipelines";
import {
  getOpportunities,
  groupByStage,
  daysSince,
  type Opportunity,
  type OpportunityStatus,
} from "@/lib/ghl/opportunities";
import { gateLocation } from "@/app/api/ghl/_lib/gate";
import { badRequest, ghlJson } from "@/app/api/ghl/_lib/respond";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/ghl/locations/[locationId]/pipeline";

const STATUS_FILTERS = ["open", "won", "lost", "abandoned", "all"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

/**
 * Days in a stage before a card is called stale. Lived as a bare `14` inside
 * the legacy board's card component; it decides a badge, so it is presentation
 * policy, but it is computed here because `lastStageChangeAt` needs
 * `daysSince` from lib/ and the Angular client cannot import lib/.
 */
export const STALE_STAGE_DAYS = 14;

export type PipelineCard = Opportunity & {
  /** Whole days since the last stage change, or null when GHL sent no timestamp. */
  daysInStage: number | null;
  stale: boolean;
};

export type PipelineColumn = {
  stage: PipelineStage;
  cards: PipelineCard[];
  count: number;
  value: number;
};

export type PipelineBoard = {
  pipeline: { id: string; name: string };
  columns: PipelineColumn[];
  /**
   * Opportunities whose `pipelineStageId` is not one of this pipeline's
   * stages. The legacy board dropped these silently by iterating stages and
   * reading the group map; a deal that vanishes from a board is worse than one
   * in an "unknown" column.
   */
  unstaged: PipelineCard[];
  count: number;
  value: number;
};

export type PipelineResponse = {
  status: StatusFilter;
  staleAfterDays: number;
  boards: PipelineBoard[];
};

function toCard(opportunity: Opportunity): PipelineCard {
  const days = daysSince(opportunity.lastStageChangeAt ?? opportunity.updatedAt);
  return {
    ...opportunity,
    daysInStage: days,
    stale: days !== null && days >= STALE_STAGE_DAYS,
  };
}

function sumValue(opportunities: Opportunity[]): number {
  return opportunities.reduce((total, opportunity) => total + (opportunity.monetaryValue || 0), 0);
}

/**
 * GET /api/ghl/locations/[locationId]/pipeline?status=open
 *
 * Every pipeline for the location, each already bucketed into its stages.
 * Grouping happens here rather than on the client because `groupByStage` is
 * the existing implementation and re-deriving it in Angular is how the two
 * would drift.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> },
) {
  const { locationId } = await params;
  const gate = await gateLocation(locationId, CONTEXT);
  if (!gate.ok) return gate.response;

  const requested = request.nextUrl.searchParams.get("status");
  if (requested !== null && !STATUS_FILTERS.includes(requested as StatusFilter)) {
    return badRequest(CONTEXT, `status must be one of: ${STATUS_FILTERS.join(", ")}.`);
  }
  const status: StatusFilter = (requested as StatusFilter | null) ?? "open";

  return ghlJson<PipelineResponse>(CONTEXT, async () => {
    const pipelines = await getPipelines(locationId);

    const boards = await Promise.all(
      pipelines.map(async (pipeline): Promise<PipelineBoard> => {
        const opportunities = await getOpportunities(locationId, pipeline.id, {
          status: status as OpportunityStatus | "all",
        });
        const grouped = groupByStage(opportunities);
        const known = new Set(pipeline.stages.map((stage) => stage.id));

        const columns = pipeline.stages.map((stage): PipelineColumn => {
          const inStage = grouped.get(stage.id) ?? [];
          return {
            stage,
            cards: inStage.map(toCard),
            count: inStage.length,
            value: sumValue(inStage),
          };
        });

        const unstaged = opportunities
          .filter((opportunity) => !known.has(opportunity.pipelineStageId))
          .map(toCard);

        return {
          pipeline: { id: pipeline.id, name: pipeline.name },
          columns,
          unstaged,
          count: opportunities.length,
          value: sumValue(opportunities),
        };
      }),
    );

    return { status, staleAfterDays: STALE_STAGE_DAYS, boards };
  });
}
