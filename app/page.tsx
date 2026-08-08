import { getPipelines } from "@/lib/ghl/pipelines";
import {
  getOpportunities,
  groupByStage,
  daysSince,
  formatMoney,
  type Opportunity,
  type OpportunityStatus,
} from "@/lib/ghl/opportunities";
import {
  devLocationId,
  GhlConfigError,
  LocationNotAuthorizedError,
} from "@/lib/ghl/tokens";

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
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : "border-red-300 bg-red-50 text-red-900";
  return (
    <div className={`max-w-2xl rounded-lg border p-6 ${styles}`}>
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-2 text-sm">{children}</div>
    </div>
  );
}

function Card({ opportunity }: { opportunity: Opportunity }) {
  const days = daysSince(opportunity.lastStageChangeAt ?? opportunity.updatedAt);
  const stale = days !== null && days >= 14;
  const title =
    opportunity.contact?.name?.trim() ||
    opportunity.name?.trim() ||
    "Unnamed opportunity";

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-neutral-900">{title}</span>
        {opportunity.monetaryValue > 0 && (
          <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900">
            {formatMoney(opportunity.monetaryValue)}
          </span>
        )}
      </div>

      {opportunity.contact?.companyName && (
        <p className="mt-1 truncate text-xs text-neutral-500">
          {opportunity.contact.companyName}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {opportunity.source && (
          <span className="truncate text-neutral-500">
            {opportunity.source}
          </span>
        )}
        {days !== null && (
          <span
            className={
              stale
                ? "rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800"
                : "text-neutral-400"
            }
          >
            {days}d in stage
          </span>
        )}
      </div>
    </div>
  );
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const status = (
    STATUS_FILTERS.includes(statusParam as never) ? statusParam : "open"
  ) as OpportunityStatus | "all";

  const locationId = devLocationId();
  if (!locationId) {
    return (
      <Notice tone="warn" title="Setup needed">
        <p>
          No location configured. Set <code>GHL_LOCATION_ID</code> in{" "}
          <code>hub/.env.local</code>, then restart the dev server.
        </p>
      </Notice>
    );
  }

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
        <span className="text-sm text-neutral-500">Showing</span>
        {STATUS_FILTERS.map((option) => {
          const active = option === status;
          return (
            <a
              key={option}
              href={`/?status=${option}`}
              className={
                active
                  ? "rounded-full bg-black px-3 py-1 text-xs font-semibold text-[#ebc507]"
                  : "rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:border-neutral-400"
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
              <span className="text-sm text-neutral-500">
                {opportunities.length} {status === "all" ? "" : status}{" "}
                {opportunities.length === 1 ? "deal" : "deals"}
              </span>
              {total > 0 && (
                <span className="text-sm font-medium tabular-nums text-neutral-700">
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
                    className="flex w-64 shrink-0 flex-col rounded-lg border border-neutral-200 bg-neutral-50"
                  >
                    <div className="border-b border-neutral-200 px-3 py-2.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <h2 className="truncate text-sm font-medium">
                          {stage.name}
                        </h2>
                        <span className="shrink-0 text-xs text-neutral-500">
                          {cards.length}
                        </span>
                      </div>
                      {stageTotal > 0 && (
                        <p className="mt-0.5 text-xs tabular-nums text-neutral-500">
                          {formatMoney(stageTotal)}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 p-2">
                      {cards.length === 0 ? (
                        <p className="px-1 py-3 text-xs text-neutral-400">
                          Empty
                        </p>
                      ) : (
                        cards.map((opportunity) => (
                          <Card
                            key={opportunity.id}
                            opportunity={opportunity}
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
