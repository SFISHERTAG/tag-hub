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

const GHL_HOST = "https://services.leadconnectorhq.com";

/**
 * Sanity cap on pagination, not a result cap. 50 pages of 100 is far beyond
 * any real pipeline here; hitting it means GHL is looping or the pipeline has
 * outgrown every assumption this integration makes. Either way the answer is
 * an error, because returning what was fetched so far is the silent-truncation
 * bug this function exists to close.
 */
const MAX_PAGES = 50;

/**
 * Every opportunity for one pipeline, following pagination to exhaustion.
 *
 * `getOpportunities` above returns a single page (its `limit`, default 100)
 * and ignores `meta.nextPageUrl` — fine for a board that shows the top of a
 * pipeline, and silently wrong for anything that SUMS the result: the metric
 * adapter was totalling at most the first 100 rows per pipeline, a number
 * that quietly stops growing with the business. Use this variant wherever the
 * caller needs the whole population.
 *
 * The follow-up URL goes back through `ghl()`, so `requireLocationAccess`
 * runs on every page, and a nextPageUrl pointing off the GHL host is refused
 * rather than fetched.
 */
export async function searchAllOpportunities(
  locationId: string,
  pipelineId: string,
  options: { status?: OpportunityStatus | "all" } = {},
): Promise<Opportunity[]> {
  const { status = "open" } = options;

  const all: Opportunity[] = [];
  let data = await ghl<SearchResponse>(locationId, "/opportunities/search", {
    searchParams: {
      location_id: locationId,
      pipeline_id: pipelineId,
      limit: 100,
      ...(status === "all" ? {} : { status }),
    },
  });
  all.push(...(data.opportunities ?? []));

  let pages = 1;
  while (data.meta?.nextPageUrl) {
    const next = data.meta.nextPageUrl;
    if (!next.startsWith(GHL_HOST)) {
      throw new Error(`Refusing to follow a pagination URL off the GHL host: ${next}`);
    }
    if (pages >= MAX_PAGES) {
      throw new Error(
        `Opportunity search for pipeline ${pipelineId} exceeded ${MAX_PAGES} pages; ` +
          `refusing to return a truncated set as if it were complete.`,
      );
    }
    data = await ghl<SearchResponse>(locationId, next);
    all.push(...(data.opportunities ?? []));
    pages += 1;
  }

  return all;
}

/** Get an opportunity by contact ID. Returns the first match (contacts may have multiple). */
export async function getOpportunityForContact(
  locationId: string,
  contactId: string,
): Promise<Opportunity | null> {
  const data = await ghl<SearchResponse>(locationId, "/opportunities/search", {
    searchParams: {
      location_id: locationId,
      contact_id: contactId,
      limit: 1,
      status: "all",
    },
  });

  return data.opportunities?.[0] ?? null;
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

/** Updates an opportunity's pipeline stage. Returns updated `lastStageChangeAt` timestamp. */
export async function updateOpportunityStage(
  locationId: string,
  opportunityId: string,
  pipelineStageId: string,
): Promise<{ lastStageChangeAt: string }> {
  const data = await ghl<{ lastStageChangeAt?: string }>(
    locationId,
    `/opportunities/${opportunityId}`,
    {
      method: "PUT",
      body: { pipelineStageId },
    },
  );

  return {
    lastStageChangeAt: data.lastStageChangeAt ?? new Date().toISOString(),
  };
}

/** Marks an opportunity won or lost with a monetary value. */
export async function closeOpportunity(
  locationId: string,
  opportunityId: string,
  status: "won" | "lost",
  monetaryValue: number,
): Promise<{ status: OpportunityStatus; monetaryValue: number }> {
  if (status === "won" && monetaryValue === null) {
    throw new Error("Monetary value is required when marking an opportunity won.");
  }

  const data = await ghl<{ status?: OpportunityStatus; monetaryValue?: number }>(
    locationId,
    `/opportunities/${opportunityId}`,
    {
      method: "PUT",
      body: { status, monetaryValue: monetaryValue ?? 0 },
    },
  );

  return {
    status: data.status ?? status,
    monetaryValue: data.monetaryValue ?? monetaryValue,
  };
}

// Re-exported so existing server-side callers keep their import path.
export { daysSince, formatMoney } from "./format";
