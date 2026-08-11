import { Stat } from "../../ui";
import type { MockMetrics } from "@/lib/dashboard/mock-metrics";

const currency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function KpiTiles({ kpis }: { kpis: MockMetrics["kpis"] }) {
  const budgetPct = Math.round((kpis.spendActual / kpis.spendBudget) * 100);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Stat
        label="Ad spend"
        value={currency(kpis.spendActual)}
        delta={`${budgetPct}% of ${currency(kpis.spendBudget)} budget`}
        tone={budgetPct > 100 ? "warn" : "neutral"}
      />
      <Stat label="ROAS" value={`${kpis.roas.toFixed(1)}×`} tone="ok" />
      <Stat label="Cost per lead" value={currency(kpis.cpl)} />
      <Stat label="Booking rate" value={`${kpis.bookingRatePct}%`} />
      <Stat label="Cost per booked call" value={currency(kpis.costPerBooked)} />
    </div>
  );
}
