"use server";

import { getSession } from "@/lib/auth/session";
import { saveDashboardConfig } from "@/lib/dashboard/customization";
import { getAvailableWidgets, type DashboardConfig } from "@/lib/dashboard/widget";

type Result = { ok: true } | { ok: false; error: string };

export async function saveDashboardConfigAction(
  config: DashboardConfig,
): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in" };

  if (config.role !== session.currentRole) {
    return { ok: false, error: "Role mismatch" };
  }

  // config.role matching session.currentRole only proves the config is
  // labeled correctly, not that every widget placed inside it is actually
  // allowed for that role. A crafted payload could still smuggle in a
  // widget scoped to a different role and have it render. Cross-check every
  // placement against the same registry the UI uses to decide what to offer.
  const availableWidgetIds = new Set(
    getAvailableWidgets(session.currentRole).map((widget) => widget.id),
  );
  const hasUnavailableWidget = (config.pages ?? []).some((page) =>
    (page.widgets ?? []).some((placement) => !availableWidgetIds.has(placement.widgetId)),
  );
  if (hasUnavailableWidget) {
    return { ok: false, error: "Config references a widget not available to this role" };
  }

  try {
    await saveDashboardConfig(session.uid, config);
    return { ok: true };
  } catch (error) {
    console.error("Failed to save dashboard config:", error);
    return { ok: false, error: "Failed to save configuration" };
  }
}
