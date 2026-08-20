"use server";

import { getSession } from "@/lib/auth/session";
import { saveDashboardConfig } from "@/lib/dashboard/customization";
import { canUseWidget } from "@/lib/dashboard/widget";
import type { DashboardConfig } from "@/lib/dashboard/widget";

type Result = { ok: true } | { ok: false; error: string };

export async function saveDashboardConfigAction(
  config: DashboardConfig,
): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in" };

  if (config.role !== session.currentRole) {
    return { ok: false, error: "Role mismatch" };
  }

  // Matching roles only proves the config claims to be the caller's. It says
  // nothing about the widgets inside it, and the dashboard fetches data for
  // whatever widget ids it finds — so an unauthorized widget saved here
  // renders another role's live data on the next load.
  const forbidden = config.pages
    .flatMap((page) => page.widgets)
    .map((w) => w.widgetId)
    .filter((widgetId) => !canUseWidget(session.currentRole, widgetId));

  if (forbidden.length > 0) {
    return {
      ok: false,
      error: `Not available to this role: ${[...new Set(forbidden)].join(", ")}`,
    };
  }

  try {
    await saveDashboardConfig(session.uid, config);
    return { ok: true };
  } catch (error) {
    console.error("Failed to save dashboard config:", error);
    return { ok: false, error: "Failed to save configuration" };
  }
}
