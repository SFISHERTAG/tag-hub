"use client";

import type { WidgetPlacement } from "@/lib/dashboard/widget";
import { WIDGET_REGISTRY } from "@/lib/dashboard/widget";
import type { CsmBookSummary, DepartmentSummary } from "@/lib/dashboard/team-rollup";
import { TeamHealthRollup } from "./widgets/team-health-rollup";
import { DepartmentOverview } from "./widgets/department-overview";

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
  return (
    <div className="grid auto-rows-max gap-4" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
      {widgets.map((placement) => {
        const widget = WIDGET_REGISTRY[placement.widgetId];
        if (!widget) return null;

        const gridStyle = {
          gridColumn: `span ${placement.size.cols}`,
          gridRow: `span ${placement.size.rows}`,
        };

        // These two are wired to real data — they render their own Panel
        // rather than the generic placeholder box below. Every other
        // registry entry still has no component behind it.
        if (placement.widgetId === "team_health_rollup" && teamHealthRollup) {
          return (
            <div key={placement.id} style={gridStyle}>
              <TeamHealthRollup books={teamHealthRollup} />
            </div>
          );
        }
        if (placement.widgetId === "department_overview" && departmentOverview) {
          return (
            <div key={placement.id} style={gridStyle}>
              <DepartmentOverview summary={departmentOverview} />
            </div>
          );
        }

        return (
          <div
            key={placement.id}
            style={gridStyle}
            className="rounded-lg border border-chrome-line bg-chrome p-4"
          >
            <div className="flex h-full flex-col">
              <h3 className="font-semibold text-ink mb-3">{widget.title}</h3>
              <p className="text-xs text-chrome-ink-2">{widget.description}</p>
              {/* Widget content will be rendered here */}
              <div className="flex-1 flex items-center justify-center text-chrome-ink-2 text-sm">
                <span>[{widget.id} widget]</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
