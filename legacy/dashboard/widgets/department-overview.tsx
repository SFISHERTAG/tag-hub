import { Panel, Stat } from "../../ui";
import { SampleDataBanner } from "./sample-data-banner";
import type { DepartmentSummary } from "@/lib/dashboard/team-rollup";

/** Exec-facing: the boardroom view — department totals plus which books need eyes first. */
export function DepartmentOverview({ summary }: { summary: DepartmentSummary }) {
  const healthTone = summary.avgHealthScore >= 75 ? "ok" : summary.avgHealthScore >= 60 ? "warn" : "danger";

  return (
    <Panel
      title="Department overview"
      meta={`${summary.csmCount} ${summary.csmCount === 1 ? "CSM" : "CSMs"}`}
    >
      <SampleDataBanner />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total clients" value={summary.totalClients} />
        <Stat label="Avg health score" value={summary.avgHealthScore} tone={healthTone} />
        <Stat
          label="Need attention"
          value={summary.needsAttentionCount}
          tone={summary.needsAttentionCount > 0 ? "danger" : "ok"}
        />
        <Stat
          label="Ascension ready"
          value={summary.ascensionReadyCount}
          tone={summary.ascensionReadyCount > 0 ? "ok" : "neutral"}
        />
      </div>

      {summary.booksByRisk.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-ink-3">Books needing attention first</p>
          <ol className="space-y-1.5">
            {summary.booksByRisk.slice(0, 5).map((book) => (
              <li key={book.csmEmail} className="flex items-center justify-between text-sm">
                <span className="truncate text-ink-2">{book.csmEmail}</span>
                <span className="tabular-nums text-ink-3">{book.avgHealthScore}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Panel>
  );
}
