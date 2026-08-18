"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  DashboardConfig,
  DashboardPage,
  WidgetDefinition,
  WidgetPlacement,
} from "@/lib/dashboard/widget-definitions";
import type { Role } from "@/lib/auth/roles";
import { saveDashboardConfigAction } from "./actions";

export function CustomizeClient({
  config,
  availableWidgets,
  currentPageId,
  currentRole,
}: {
  config: DashboardConfig;
  availableWidgets: WidgetDefinition[];
  currentPageId: string;
  currentRole: Role;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentPage = config.pages.find((p) => p.id === currentPageId);
  if (!currentPage) return null;

  const activeWidgetIds = new Set(currentPage.widgets.map((w) => w.widgetId));

  async function persist(page: DashboardPage, widgets: WidgetPlacement[]) {
    const updatedPage: DashboardPage = { ...page, widgets };
    const updatedConfig: DashboardConfig = {
      ...config,
      pages: config.pages.map((p) => (p.id === currentPageId ? updatedPage : p)),
    };

    setSaving(true);
    setError(null);

    try {
      const result = await saveDashboardConfigAction(updatedConfig);
      if (!result.ok) {
        setError(result.error);
      }
    } catch {
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function toggleWidget(page: DashboardPage, widgetId: string) {
    const isActive = page.widgets.some((w) => w.widgetId === widgetId);
    let widgets: WidgetPlacement[];

    if (isActive) {
      widgets = page.widgets.filter((w) => w.widgetId !== widgetId);
    } else {
      const widget = availableWidgets.find((w) => w.id === widgetId);
      if (!widget) return;
      widgets = [
        ...page.widgets,
        {
          id: `${widgetId}_${Date.now()}`,
          widgetId,
          position: { x: 0, y: 0 },
          size: widget.defaultSize,
        },
      ];
    }

    await persist(page, widgets);
  }

  async function moveWidget(page: DashboardPage, index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= page.widgets.length) return;

    const widgets = [...page.widgets];
    [widgets[index], widgets[target]] = [widgets[target], widgets[index]];

    await persist(page, widgets);
  }

  return (
    <div className="space-y-6">
      {/* Active widgets, reorderable */}
      {currentPage.widgets.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-ink">Active Widgets</h2>
          <ol className="space-y-2">
            {currentPage.widgets.map((placement, index) => {
              const widget = availableWidgets.find((w) => w.id === placement.widgetId);
              return (
                <li
                  key={placement.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-chrome-line bg-chrome p-3"
                >
                  <span className="text-sm font-medium text-ink">
                    {widget?.title ?? placement.widgetId}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => moveWidget(currentPage, index, -1)}
                      disabled={saving || index === 0}
                      aria-label={`Move ${widget?.title ?? placement.widgetId} up`}
                      className="rounded-md border border-chrome-line px-2 py-1 text-xs text-chrome-ink-2 hover:bg-chrome-hover disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveWidget(currentPage, index, 1)}
                      disabled={saving || index === currentPage.widgets.length - 1}
                      aria-label={`Move ${widget?.title ?? placement.widgetId} down`}
                      className="rounded-md border border-chrome-line px-2 py-1 text-xs text-chrome-ink-2 hover:bg-chrome-hover disabled:opacity-40"
                    >
                      ↓
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Available Widgets */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-ink">Available Widgets</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {availableWidgets.map((widget) => {
            const isActive = activeWidgetIds.has(widget.id);
            return (
              <button
                key={widget.id}
                type="button"
                onClick={() => toggleWidget(currentPage, widget.id)}
                disabled={saving}
                aria-pressed={isActive}
                className={`rounded-lg border-2 p-4 text-left transition-all ${
                  isActive
                    ? "border-accent bg-accent/10"
                    : "border-chrome-line bg-chrome hover:border-line-strong"
                } disabled:opacity-60`}
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isActive ? "border-accent bg-accent text-accent-ink" : "border-chrome-line"
                    }`}
                  >
                    {isActive && "✓"}
                  </span>
                  <div className="flex-1">
                    <h3 className="font-medium text-ink">{widget.title}</h3>
                    {widget.description && (
                      <p className="text-xs text-chrome-ink-2">{widget.description}</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div role="alert" className="rounded-lg border border-danger bg-danger-tint p-4 text-danger">
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href="/dashboard"
          className="rounded-md border border-chrome-line bg-chrome px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-chrome-hover"
        >
          Done
        </Link>
      </div>
    </div>
  );
}
