import { Panel } from "../../ui";
import type { MockMetrics } from "@/lib/dashboard/mock-metrics";

const currency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function TopDeals({ deals }: { deals: MockMetrics["topDeals"] }) {
  if (deals.length === 0) {
    return (
      <Panel title="Top deals">
        <p className="text-sm text-ink-3">No deals yet.</p>
      </Panel>
    );
  }

  return (
    <Panel title="Top deals">
      <ol className="space-y-3">
        {deals.map((deal, i) => (
          <li key={deal.name} className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink"
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{deal.name}</p>
              <p className="text-xs text-ink-3">{deal.stage}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
              {currency(deal.value)}
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
