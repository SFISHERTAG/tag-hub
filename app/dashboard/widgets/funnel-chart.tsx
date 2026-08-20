import { Panel } from "../../ui";
import type { FunnelCountsResult } from "@/lib/dashboard/funnel";

/**
 * Heat-shaded by conversion off the previous stage, not off the raw count —
 * a raw-count heatmap just repaints the funnel shape everyone already sees in
 * the numbers. Shading the conversion percentage instead is what tells a
 * client owner *where* the leak is: high Leads->Booked drop points at
 * targeting, high Booked->Showed at reminders/lead quality, high
 * Showed->Closed at the closer or offer.
 */
function heat(pct: number): string {
  if (pct >= 60) return "bg-ok/15 text-ok";
  if (pct >= 30) return "bg-warn/15 text-warn";
  return "bg-danger/15 text-danger";
}

export function FunnelChart({ result }: { result: FunnelCountsResult }) {
  if (!result.ok) {
    return (
      <Panel title="Funnel" meta="Leads → booked → showed → closed">
        <p className="text-sm text-ink-3">{result.message}</p>
      </Panel>
    );
  }

  const { stages, showRateDenominator, dqBreakdown, truncated } = result;
  const leads = stages[0]?.count ?? 0;

  if (leads === 0) {
    return (
      <Panel title="Funnel" meta="Leads → booked → showed → closed">
        <p className="text-sm text-ink-3">No leads in this window.</p>
      </Panel>
    );
  }

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
          {stages.map((stage, i) => {
            // Story 6.4: Showed's conversion is off (Booked − pre-call DQ),
            // not raw Booked — a pre-call DQ never had a real shot to show.
            const prev =
              stage.stage === "Showed" ? showRateDenominator : i > 0 ? stages[i - 1].count : stage.count;
            const ofPrevious = i === 0 ? 100 : prev > 0 ? Math.round((stage.count / prev) * 100) : 0;
            const ofLeads = leads > 0 ? Math.round((stage.count / leads) * 100) : 0;

            return (
              <tr key={stage.stage} className="border-t border-line">
                <td className="py-2.5 font-medium text-ink">{stage.stage}</td>
                <td className="py-2.5 text-right tabular-nums text-ink">{stage.count}</td>
                <td className="py-2.5 text-right">
                  <span
                    className={`inline-block min-w-12 rounded px-1.5 py-0.5 text-xs font-medium tabular-nums ${heat(ofPrevious)}`}
                  >
                    {i === 0 ? "—" : `${ofPrevious}%`}
                  </span>
                </td>
                <td className="py-2.5 text-right tabular-nums text-ink-3">{ofLeads}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {truncated && (
        <p className="mt-3 rounded border border-warn/30 bg-warn-tint px-2.5 py-1.5 text-xs text-warn">
          Partial data: more contacts exist in this window than could be
          fetched, so every stage below is an undercount. Narrow the window
          for a complete funnel.
        </p>
      )}
      {(dqBreakdown.preCall > 0 || dqBreakdown.onCall > 0) && (
        <p className="mt-3 text-xs text-ink-3">
          DQ breakdown: <span className="font-medium text-ink-2">{dqBreakdown.preCall} pre-call</span>{" "}
          (dropped from show rate) · <span className="font-medium text-ink-2">{dqBreakdown.onCall} on-call</span>{" "}
          (counts as showed)
        </p>
      )}
    </Panel>
  );
}
