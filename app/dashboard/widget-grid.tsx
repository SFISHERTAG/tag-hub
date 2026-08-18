"use client";

import type { WidgetPlacement } from "@/lib/dashboard/widget";
import { WIDGET_REGISTRY, MOCK_METRICS_WIDGET_IDS } from "@/lib/dashboard/widget";
import type { CsmBookSummary, DepartmentSummary } from "@/lib/dashboard/team-rollup";
import { MOCK_METRICS } from "@/lib/dashboard/mock-metrics";
import { Pending } from "../ui";
import { TeamHealthRollup } from "./widgets/team-health-rollup";
import { DepartmentOverview } from "./widgets/department-overview";
import { KpiTiles } from "./widgets/kpi-tiles";
import { FunnelTable } from "./widgets/funnel-table";
import { TopDeals } from "./widgets/top-deals";
import { SpendCharts } from "./widgets/spend-charts";
import { SampleDataBanner } from "./widgets/sample-data-banner";

export function WidgetGrid({
  widgets,
  teamHealthRollup,
  departmentOverview,
}: {
  widgets: WidgetPlacement[];
  /** Only present for a tag_csd viewer — see app/dashboard/page.tsx. */
  teamHealthRollup?: CsmBookSummary[];
  /** Only present for a tag_exec viewer — see app/dashboard/page.tsx. */
  departmentOverview?: DepartmentSummary;
}) {
  const hasMockMetricsWidget = widgets.some((w) => MOCK_METRICS_WIDGET_IDS.includes(w.widgetId));

  return (
    <div className="space-y-4">
      {hasMockMetricsWidget && <SampleDataBanner />}
      <div className="grid auto-rows-max gap-4" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {widgets.map((placement) => {
          const widget = WIDGET_REGISTRY[placement.widgetId];
          if (!widget) return null;

          const gridStyle = {
            gridColumn: `span ${placement.size.cols}`,
            gridRow: `span ${placement.size.rows}`,
          };

          let content: React.ReactNode;

          if (placement.widgetId === "team_health_rollup" && teamHealthRollup) {
            content = <TeamHealthRollup books={teamHealthRollup} />;
          } else if (placement.widgetId === "department_overview" && departmentOverview) {
            content = <DepartmentOverview summary={departmentOverview} />;
          } else if (placement.widgetId === "kpi_summary") {
            content = <KpiTiles kpis={MOCK_METRICS.kpis} />;
          } else if (placement.widgetId === "leads_funnel") {
            content = <FunnelTable funnel={MOCK_METRICS.funnel} />;
          } else if (placement.widgetId === "spend_roas") {
            content = <SpendCharts spendByChannel={MOCK_METRICS.spendByChannel} spendByAd={MOCK_METRICS.spendByAd} />;
          } else if (placement.widgetId === "pipeline_board") {
            content = <TopDeals deals={MOCK_METRICS.topDeals} />;
          } else {
            content = (
              <div className="rounded-lg border border-chrome-line bg-chrome p-4">
                <h3 className="mb-3 font-semibold text-ink">{widget.title}</h3>
                <Pending story={widget.description ?? "Not built yet"} note="Coming soon." />
              </div>
            );
          }

          return (
            <div key={placement.id} role="region" aria-label={widget.title} style={gridStyle}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
