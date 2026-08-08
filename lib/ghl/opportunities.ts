import "server-only";
import { ghl } from "./client";

export type OpportunityStatus = "open" | "won" | "lost" | "abandoned";

export type Opportunity = {
  id: string;
  name: string;
  pipelineId: string;
  pipelineStageId: string;
  status: OpportunityStatus;
  monetaryValue: number;
  source?: string;
  createdAt: string;
  updatedAt: string;
  lastStageChangeAt?: string;
  assignedTo?: string | null;
  contact?: {
    id: string;
    name?: string;
    email?: string;
    phone?: string;
    companyName?: string;
  };
};

type SearchResponse = {
  opportunities?: Opportunity[];
  meta?: { total?: number; nextPageUrl?: string | null };
};

/**
 * Opportunities for one pipeline.
 *
 * Defaults to open only. This location carries far more abandoned records than
 * live ones, so an unfiltered board buries the deals anyone actually works.
 */
export async function getOpportunities(
  locationId: string,
  pipelineId: string,
  options: { status?: OpportunityStatus | "all"; limit?: number } = {},
): Promise<Opportunity[]> {
  const { status = "open", limit = 100 } = options;

  const data = await ghl<SearchResponse>(locationId, "/opportunities/search", {
    searchParams: {
      location_id: locationId,
      pipeline_id: pipelineId,
      limit,
      ...(status === "all" ? {} : { status }),
    },
  });

  return data.opportunities ?? [];
}

/** Groups opportunities by stage id for board rendering. */
export function groupByStage(
  opportunities: Opportunity[],
): Map<string, Opportunity[]> {
  const grouped = new Map<string, Opportunity[]>();
  for (const opportunity of opportunities) {
    const bucket = grouped.get(opportunity.pipelineStageId);
    if (bucket) bucket.push(opportunity);
    else grouped.set(opportunity.pipelineStageId, [opportunity]);
  }
  return grouped;
}

/** Whole days since a timestamp, or null when absent/unparseable. */
export function daysSince(timestamp: string | undefined): number | null {
  if (!timestamp) return null;
  const then = Date.parse(timestamp);
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}
