import { getPipelines, type PipelineStage } from "@/lib/ghl/pipelines";
import {
  getOpportunities,
  groupByStage,
  daysSince,
  formatMoney,
  type Opportunity,
  type OpportunityStatus,
} from "@/lib/ghl/opportunities";
import {
  GhlConfigError,
  LocationNotAuthorizedError,
} from "@/lib/ghl/tokens";
import { StageControl } from "./stage-control";
import { CloseControl } from "./close-control";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = ["open", "won", "lost", "abandoned", "all"] as const;

function Notice({
  tone,
  title,
  children,
}: {
  tone: "warn" | "error";
  title: string;
  children: React.ReactNode;
}) {
  const styles =
    tone === "warn"
      ? "border-warn/30 bg-warn-tint text-warn"
      : "border-danger/30 bg-danger-tint text-danger";
  return (
    <div className={`max-w-2xl rounded-lg border p-6 ${styles}`}>
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-2 text-sm">{children}</div>
    </div>
  );
}

function Card({
  locationId,
  opportunity,
  stages,
}: {
  locationId: string;
  opportunity: Opportunity;
  stages: PipelineStage[];
}) {
  const days = daysSince(opportunity.lastStageChangeAt ?? opportunity.updatedAt);
  const stale = days !== null && days >= 14;
  const title =
    opportunity.contact?.name?.trim() ||
    opportunity.name?.trim() ||
    "Unnamed opportunity";

  return (
    <div className="rounded-md border border-line bg-surface p-3 lift">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-ink">{title}</span>
        {opportunity.monetaryValue > 0 && (
          <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
            {formatMoney(opportunity.monetaryValue)}
          </span>
        )}
      </div>

      {opportunity.contact?.companyName && (
        <p className="mt-1 truncate text-xs text-ink-3">
          {opportunity.contact.companyName}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {opportunity.source && (
          <span className="truncate text-ink-3">
            {opportunity.source}
          </span>
        )}
        {days !== null && (
          <span
            className={
              stale
                ? "rounded bg-warn-tint px-1.5 py-0.5 font-medium text-warn"
                : "text-chrome-ink-2"
            }
          >
            {days}d in stage
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2 border-t border-line pt-2">
        <StageControl
          locationId={locationId}
          opportunityId={opportunity.id}
          currentStageId={opportunity.pipelineStageId}
          allStages={stages}
        />
        <CloseControl
          locationId={locationId}
          opportunityId={opportunity.id}
          currentStatus={opportunity.status}
          currentValue={opportunity.monetaryValue}
          contactId={opportunity.contact?.id}
        />
      </div>
    </div>
  );
}

export default async function PipelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locationId } = await params;
  const { status: statusParam } = await searchParams;
  const status = (
    STATUS_FILTERS.includes(statusParam as never) ? statusParam : "open"
  ) as OpportunityStatus | "all";

  let boards;
  try {
    const pipelines = await getPipelines(locationId);
    boards = await Promise.all(
      pipelines.map(async (pipeline) => ({
        pipeline,
        opportunities: await getOpportunities(locationId, pipeline.id, {
          status,
        }),
      })),
    );
  } catch (error) {
    if (error instanceof GhlConfigError) {
      return (
        <Notice tone="warn" title="Setup needed">
          <p>{error.message}</p>
        </Notice>
      );
    }
    if (error instanceof LocationNotAuthorizedError) {
      return (
        <Notice tone="warn" title="Location not reachable">
          <p>{error.message}</p>
        </Notice>
      );
    }
    return (
      <Notice tone="error" title="GHL rejected the request">
        <p className="font-mono text-xs whitespace-pre-wrap">
          {error instanceof Error ? error.message : String(error)}
        </p>
      </Notice>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-3">Showing</span>
        {STATUS_FILTERS.map((option) => {
          const active = option === status;
          return (
            <a
              key={option}
              href={`/l/${locationId}/pipeline?status=${option}`}
              className={
                active
                  ? "rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-ink"
                  : "rounded-full border border-line px-3 py-1 text-xs text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
              }
            >
              {option}
            </a>
          );
        })}
      </div>

      {boards.map(({ pipeline, opportunities }) => {
        const byStage = groupByStage(opportunities);
        const total = opportunities.reduce(
          (sum, o) => sum + (o.monetaryValue || 0),
          0,
        );

        return (
          <section key={pipeline.id}>
            <div className="mb-4 flex flex-wrap items-baseline gap-3">
              <h1 className="text-xl font-semibold tracking-tight">
                {pipeline.name}
              </h1>
              <span className="text-sm text-ink-3">
                {opportunities.length} {status === "all" ? "" : status}{" "}
                {opportunities.length === 1 ? "deal" : "deals"}
              </span>
              {total > 0 && (
                <span className="text-sm font-medium tabular-nums text-ink-2">
                  {formatMoney(total)}
                </span>
              )}
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2">
              {pipeline.stages.map((stage) => {
                const cards = byStage.get(stage.id) ?? [];
                const stageTotal = cards.reduce(
                  (sum, o) => sum + (o.monetaryValue || 0),
                  0,
                );

                return (
                  <div
                    key={stage.id}
                    className="flex w-64 shrink-0 flex-col rounded-lg border border-line bg-sunken"
                  >
                    <div className="border-b border-line px-3 py-2.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <h2 className="truncate text-sm font-medium">
                          {stage.name}
                        </h2>
                        <span className="shrink-0 text-xs text-ink-3">
                          {cards.length}
                        </span>
                      </div>
                      {stageTotal > 0 && (
                        <p className="mt-0.5 text-xs tabular-nums text-ink-3">
                          {formatMoney(stageTotal)}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 p-2">
                      {cards.length === 0 ? (
                        <p className="px-1 py-3 text-xs text-chrome-ink-2">
                          Empty
                        </p>
                      ) : (
                        cards.map((opportunity) => (
                          <Card
                            key={opportunity.id}
                            locationId={locationId}
                            opportunity={opportunity}
                            stages={pipeline.stages}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
