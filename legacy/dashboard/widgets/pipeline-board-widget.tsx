import { Panel, Badge } from "../../ui";
import type { PipelineBoardResult } from "@/lib/dashboard/pipeline-board";

const currency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function PipelineBoardWidget({ result }: { result: PipelineBoardResult }) {
  if (!result.ok) {
    return (
      <Panel title="Pipeline">
        <p className="text-sm text-ink-3">{result.message}</p>
      </Panel>
    );
  }

  if (result.stages.length === 0) {
    return (
      <Panel title="Pipeline" meta={result.pipelineName}>
        <p className="text-sm text-ink-3">No open deals right now.</p>
      </Panel>
    );
  }

  return (
    <Panel title="Pipeline" meta={result.pipelineName}>
      <ol className="space-y-2">
        {result.stages.map((stage) => (
          <li
            key={stage.id}
            className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2"
          >
            <span className="truncate text-sm font-medium text-ink">{stage.name}</span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs tabular-nums text-ink-3">{currency(stage.value)}</span>
              <Badge tone={stage.count > 0 ? "info" : "neutral"}>{stage.count}</Badge>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
