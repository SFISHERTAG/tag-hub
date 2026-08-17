"use server";

import { getSession } from "@/lib/auth/session";
import { saveDashboardConfig } from "@/lib/dashboard/customization";
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

  try {
    await saveDashboardConfig(session.uid, config);
    return { ok: true };
  } catch (error) {
    console.error("Failed to save dashboard config:", error);
    return { ok: false, error: "Failed to save configuration" };
  }
}
