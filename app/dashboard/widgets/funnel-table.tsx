import { Panel } from "../../ui";
import type { MockMetrics } from "@/lib/dashboard/mock-metrics";

/**
 * Heat-shaded by conversion off the previous stage, not off the raw count —
 * a raw-count heatmap just repaints the funnel shape everyone already sees in
 * the numbers. Shading the conversion percentage instead is what tells a
 * client owner *where* the leak is, which is the question this table exists
 * to answer.
 */
function heat(pct: number): string {
  if (pct >= 60) return "bg-ok/15 text-ok";
  if (pct >= 30) return "bg-warn/15 text-warn";
  return "bg-danger/15 text-danger";
}

export function FunnelTable({ funnel }: { funnel: MockMetrics["funnel"] }) {
  const leads = funnel[0]?.count ?? 0;

  return (
    <Panel title="Funnel" meta="Leads → booked → showed → closed">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-3">
            <th className="pb-2 font-medium">Stage</th>
            <th className="pb-2 text-right font-medium">Count</th>
            <th className="pb-2 text-right font-medium">Of previous</th>
            <th className="pb-2 text-right font-medium">Of leads</th>
          </tr>
        </thead>
        <tbody>
          {funnel.map((stage, i) => {
            const prev = i > 0 ? funnel[i - 1].count : stage.count;
            const ofPrevious = i === 0 ? 100 : Math.round((stage.count / prev) * 100);
            const ofLeads = leads > 0 ? Math.round((stage.count / leads) * 100) : 0;

            return (
              <tr key={stage.stage} className="border-t border-line">
                <td className="py-2.5 font-medium text-ink">{stage.stage}</td>
                <td className="py-2.5 text-right tabular-nums text-ink">
                  {stage.count}
                </td>
                <td className="py-2.5 text-right">
                  <span
                    className={`inline-block min-w-12 rounded px-1.5 py-0.5 text-xs font-medium tabular-nums ${heat(ofPrevious)}`}
                  >
                    {i === 0 ? "—" : `${ofPrevious}%`}
                  </span>
                </td>
                <td className="py-2.5 text-right tabular-nums text-ink-3">
                  {ofLeads}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}
