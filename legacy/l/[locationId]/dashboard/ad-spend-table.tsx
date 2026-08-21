import type { AdSpendRow } from "@/lib/dashboard/ad-spend";

const currency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const TREND_GLYPH: Record<AdSpendRow["trend"], string> = {
  up: "↑",
  down: "↓",
  flat: "→",
};

const TREND_CLASS: Record<AdSpendRow["trend"], string> = {
  up: "text-danger",
  down: "text-good",
  flat: "text-ink-3",
};

/** Ad spend, sorted descending by the caller (getAdSpendTable already sorts). */
export function AdSpendTable({ rows }: { rows: AdSpendRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6">
        <p className="text-sm text-ink-3">No spend in this period.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-3">
            <th className="px-4 py-2.5 font-medium">Ad</th>
            <th className="px-4 py-2.5 text-right font-medium">Spend</th>
            <th className="px-4 py-2.5 text-right font-medium">Trend</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((ad) => (
            <tr key={ad.adId} className="border-b border-line last:border-0">
              <td className="truncate px-4 py-2.5 text-ink">{ad.adName}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-ink">{currency(ad.spend)}</td>
              <td className={`px-4 py-2.5 text-right font-semibold ${TREND_CLASS[ad.trend]}`}>
                {TREND_GLYPH[ad.trend]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
