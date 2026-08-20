"use client";

import type { WidgetPlacement } from "@/lib/dashboard/widget";
import { WIDGET_REGISTRY, MOCK_METRICS_WIDGET_IDS } from "@/lib/dashboard/widget";
import type { CsmBookSummary, DepartmentSummary } from "@/lib/dashboard/team-rollup";
import type { ClientData } from "@/lib/dashboard/csm-clients-types";
import type { PipelineBoardResult } from "@/lib/dashboard/pipeline-board";
import type { DayViewResult } from "@/lib/dashboard/day-view";
import type { FunnelCountsResult } from "@/lib/dashboard/funnel";
import type { OwnerCalendarResult } from "@/lib/dashboard/owner-calendar";
import type { RoasTableResult } from "@/lib/dashboard/roas";
import { MOCK_METRICS } from "@/lib/dashboard/mock-metrics";
import { Pending } from "../ui";
import { TeamHealthRollup } from "./widgets/team-health-rollup";
import { DepartmentOverview } from "./widgets/department-overview";
import { KpiTiles } from "./widgets/kpi-tiles";
import { FunnelTable } from "./widgets/funnel-table";
import { FunnelChart } from "./widgets/funnel-chart";
import { TopDeals } from "./widgets/top-deals";
import { SpendCharts } from "./widgets/spend-charts";
import { RoasTable } from "./widgets/roas-table";
import { SampleDataBanner } from "./widgets/sample-data-banner";
import { HEALTH_SAMPLE_DATA_NOTICE } from "@/lib/dashboard/mock-metrics";
import { PipelineBoardWidget } from "./widgets/pipeline-board-widget";
import { DayViewWidget } from "./widgets/day-view-widget";
import { PortfolioWidget } from "./widgets/portfolio-widget";
import { ClientHealthWidget } from "./widgets/client-health-widget";
import { OwnerCalendarWidget } from "./widgets/owner-calendar-widget";

export function WidgetGrid({
  widgets,
  teamHealthRollup,
  departmentOverview,
  portfolioClients,
  pipelineBoard,
  dayView,
  funnel,
  ownerCalendar,
  roas,
}: {
  widgets: WidgetPlacement[];
  /** Only present for a tag_csd viewer — see app/dashboard/page.tsx. */
  teamHealthRollup?: CsmBookSummary[];
  /** Only present for a tag_exec viewer — see app/dashboard/page.tsx. */
  departmentOverview?: DepartmentSummary;
  /** Backs both "portfolio" and "client_health" — same client set, different framing. */
  portfolioClients?: ClientData[];
  pipelineBoard?: PipelineBoardResult;
  dayView?: DayViewResult;
  funnel?: FunnelCountsResult;
  ownerCalendar?: OwnerCalendarResult;
  roas?: RoasTableResult;
}) {
  // leads_funnel (Story 4.3) and spend_roas (Story 4.4) are now backed by real
  // data whenever `funnel` / `roas` were fetched — they only fall back to mock
  // metrics if the caller didn't fetch them.
  const mockOnlyWidgetIds = MOCK_METRICS_WIDGET_IDS.filter(
    (id) => !(id === "leads_funnel" && funnel) && !(id === "spend_roas" && roas),
  );
  const mockWidgetIds = widgets.map((w) => w.widgetId).filter((id) => mockOnlyWidgetIds.includes(id));

  // Health scores and spend figures are two different fabrications, so the
  // banner names whichever is actually on the page. Health takes precedence
  // when both are present: it is the one that drives escalation decisions.
  const hasMockHealth = mockWidgetIds.some((id) => id === "portfolio" || id === "client_health");
  const hasMockSpend = mockWidgetIds.some((id) => id !== "portfolio" && id !== "client_health");

  return (
    <div className="space-y-4">
      {hasMockHealth ? (
        <SampleDataBanner what={HEALTH_SAMPLE_DATA_NOTICE} />
      ) : hasMockSpend ? (
        <SampleDataBanner />
      ) : null}
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
          } else if (placement.widgetId === "leads_funnel" && funnel) {
            content = <FunnelChart result={funnel} />;
          } else if (placement.widgetId === "leads_funnel") {
            content = <FunnelTable funnel={MOCK_METRICS.funnel} />;
          } else if (placement.widgetId === "spend_roas" && roas) {
            content = <RoasTable result={roas} />;
          } else if (placement.widgetId === "spend_roas") {
            content = <SpendCharts spendByChannel={MOCK_METRICS.spendByChannel} spendByAd={MOCK_METRICS.spendByAd} />;
          } else if (placement.widgetId === "pipeline_board" && pipelineBoard) {
            content = <PipelineBoardWidget result={pipelineBoard} />;
          } else if (placement.widgetId === "pipeline_board") {
            content = <TopDeals deals={MOCK_METRICS.topDeals} />;
          } else if (placement.widgetId === "day_view" && dayView) {
            content = <DayViewWidget result={dayView} />;
          } else if (placement.widgetId === "portfolio" && portfolioClients) {
            content = <PortfolioWidget clients={portfolioClients} />;
          } else if (placement.widgetId === "client_health" && portfolioClients) {
            content = <ClientHealthWidget clients={portfolioClients} />;
          } else if (placement.widgetId === "owner_calendar" && ownerCalendar) {
            content = <OwnerCalendarWidget result={ownerCalendar} />;
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
