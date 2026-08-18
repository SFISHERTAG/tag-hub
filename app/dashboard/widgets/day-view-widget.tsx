import { Panel, Badge } from "../../ui";
import type { DayViewResult } from "@/lib/dashboard/day-view";

const STATUS_TONE: Record<string, "ok" | "warn" | "danger" | "neutral" | "info"> = {
  confirmed: "ok",
  showed: "ok",
  new: "info",
  noshow: "danger",
  cancelled: "neutral",
  invalid: "neutral",
};

export function DayViewWidget({ result }: { result: DayViewResult }) {
  if (!result.ok) {
    return (
      <Panel title="Today's schedule">
        <p className="text-sm text-ink-3">{result.message}</p>
      </Panel>
    );
  }

  if (result.calls.length === 0) {
    return (
      <Panel title="Today's schedule">
        <p className="text-sm text-ink-3">No calls booked today.</p>
      </Panel>
    );
  }

  return (
    <Panel title="Today's schedule" meta={`${result.calls.length} ${result.calls.length === 1 ? "call" : "calls"}`}>
      <ol className="space-y-2">
        {result.calls.map((call) => (
          <li
            key={call.id}
            className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{call.attendee ?? "Unassigned"}</p>
              <p className="text-xs text-ink-3">
                {call.startTimeFormatted}–{call.endTimeFormatted}
                {call.topic && ` · ${call.topic}`}
              </p>
            </div>
            <Badge tone={STATUS_TONE[call.status] ?? "neutral"}>{call.status}</Badge>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
