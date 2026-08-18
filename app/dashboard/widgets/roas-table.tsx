import { Panel, Pending } from "../../ui";
import type { RoasTableResult } from "@/lib/dashboard/roas";

const currency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const roasLabel = (roas: number | null) => (roas === null ? "—" : `${roas.toFixed(2)}x`);

const TREND_LABEL: Record<"up" | "down" | "flat", string> = {
  up: "↑",
  down: "↓",
  flat: "→",
};

const TREND_CLASS: Record<"up" | "down" | "flat", string> = {
  up: "text-ok",
  down: "text-danger",
  flat: "text-ink-3",
};

export function RoasTable({ result }: { result: RoasTableResult }) {
  if (!result.ok) {
    return (
      <Panel title="Spend & ROAS">
        <Pending story={result.message} note="ROAS needs a Meta ad account and spend data." />
      </Panel>
    );
  }

  if (result.rows.length === 0) {
    return (
      <Panel title="Spend & ROAS">
        <p className="text-sm text-ink-3">No spend or conversions in this window yet.</p>
      </Panel>
    );
  }

  return (
    <Panel title="Spend & ROAS" meta="Last 30 days, sorted by ROAS">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-3">
            <th className="pb-2 font-medium">Ad</th>
            <th className="pb-2 text-right font-medium">Spend</th>
            <th className="pb-2 text-right font-medium">Revenue</th>
            <th className="pb-2 text-right font-medium">ROAS</th>
            <th className="pb-2 text-right font-medium">Trend</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row) => (
            <tr key={row.adId} className="border-t border-line">
              <td className="py-2.5 font-medium text-ink">{row.adName}</td>
              <td className="py-2.5 text-right tabular-nums text-ink">{currency(row.spend)}</td>
              <td className="py-2.5 text-right tabular-nums text-ink">{currency(row.revenue)}</td>
              <td className="py-2.5 text-right tabular-nums font-medium text-ink">
                {roasLabel(row.roas)}
              </td>
              <td
                className={`py-2.5 text-right tabular-nums ${row.trend ? TREND_CLASS[row.trend] : "text-ink-3"}`}
              >
                {row.trend ? TREND_LABEL[row.trend] : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
