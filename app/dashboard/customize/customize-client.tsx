"use client";

import { useState } from "react";
import Link from "next/link";
import type { DashboardConfig, WidgetDefinition } from "@/lib/dashboard/widget-definitions";
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

  async function toggleWidget(widgetId: string) {
    const updatedPage = { ...currentPage };
    const existingIndex = updatedPage.widgets.findIndex((w) => w.widgetId === widgetId);

    if (existingIndex >= 0) {
      // Remove widget
      updatedPage.widgets.splice(existingIndex, 1);
    } else {
      // Add widget
      const widget = availableWidgets.find((w) => w.id === widgetId);
      if (widget) {
        updatedPage.widgets.push({
          id: `${widgetId}_${Date.now()}`,
          widgetId,
          position: { x: 0, y: 0 },
          size: widget.defaultSize,
        });
      }
    }

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
    } catch (err) {
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Available Widgets */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-ink">Available Widgets</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {availableWidgets.map((widget) => {
            const isActive = activeWidgetIds.has(widget.id);
            return (
              <button
                key={widget.id}
                onClick={() => toggleWidget(widget.id)}
                disabled={saving}
                className={`rounded-lg border-2 p-4 text-left transition-all ${
                  isActive
                    ? "border-accent bg-accent/10"
                    : "border-chrome-line bg-chrome hover:border-line-strong"
                } disabled:opacity-60`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => {}}
                    className="mt-1 cursor-pointer"
                    disabled={saving}
                  />
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
        <div className="rounded-lg border border-danger bg-danger-tint p-4 text-danger">
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
