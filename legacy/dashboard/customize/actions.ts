"use server";

import { getSession } from "@/lib/auth/session";
import { saveDashboardConfig } from "@/lib/dashboard/customization";
import { getAvailableWidgets, WIDGET_REGISTRY } from "@/lib/dashboard/widget-definitions";
import type { DashboardConfig } from "@/lib/dashboard/widget";

type Result = { ok: true } | { ok: false; error: string };

const MAX_COLS = 4;
const MAX_ROWS = 4;

export async function saveDashboardConfigAction(
  config: DashboardConfig,
): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in" };

  if (config.role !== session.currentRole) {
    return { ok: false, error: "Role mismatch" };
  }

  // This is a directly-callable server action, not just something reached
  // through the customize picker's own filtered options — the picker is UI
  // convenience, this is the actual boundary. Without it, a caller could
  // save any widgetId regardless of its availableFor list and have it
  // rendered with live data on next load (see app/dashboard/page.tsx).
  const allowed = new Set(getAvailableWidgets(config.role).map((w) => w.id));
  for (const page of config.pages) {
    for (const placement of page.widgets) {
      if (!WIDGET_REGISTRY[placement.widgetId] || !allowed.has(placement.widgetId)) {
        return { ok: false, error: `Widget "${placement.widgetId}" is not available for this role.` };
      }
      const { cols, rows } = placement.size;
      if (
        !Number.isFinite(cols) || !Number.isFinite(rows) ||
        cols < 1 || rows < 1 || cols > MAX_COLS || rows > MAX_ROWS
      ) {
        return { ok: false, error: `Widget "${placement.widgetId}" has an invalid size.` };
      }
    }
  }

  try {
    await saveDashboardConfig(session.uid, config);
    return { ok: true };
  } catch (error) {
    console.error("Failed to save dashboard config:", error);
    return { ok: false, error: "Failed to save configuration" };
  }
}
