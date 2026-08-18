import { describe, expect, it, vi, beforeEach } from "vitest";
import { ROLES } from "@/lib/auth/roles";
import type { DashboardConfig } from "@/lib/dashboard/widget";

/**
 * Leak 2 (Phase 1 audit item 1.2): saving a dashboard config only checked
 * config.role === session.currentRole, never that the widgets *inside* the
 * config were actually available to that role, so a client_owner session
 * could save a config referencing a closer/exec-only widget and have it
 * render for them.
 */

const getSession = vi.fn();
const saveDashboardConfig = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getSession: () => getSession(),
}));

vi.mock("@/lib/dashboard/customization", () => ({
  saveDashboardConfig: (uid: string, config: DashboardConfig) => saveDashboardConfig(uid, config),
}));

const { saveDashboardConfigAction } = await import("./actions");

function session(currentRole: DashboardConfig["role"]) {
  if (!ROLES.includes(currentRole)) {
    throw new Error(`${currentRole} is not a recognized role`);
  }
  return {
    uid: "user-1",
    email: "owner@client.com",
    currentRole,
    availableRoles: [currentRole],
    locations: ["loc-1"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveDashboardConfigAction", () => {
  it("rejects a config containing a widget not available to the session's role", async () => {
    getSession.mockResolvedValue(session("client_owner"));

    // day_view is availableFor client_closer/tag_exec only, not client_owner.
    const config: DashboardConfig = {
      role: "client_owner",
      currentPage: 0,
      updatedAt: Date.now(),
      pages: [
        {
          id: "default",
          title: "Owner",
          widgets: [
            { id: "day_view_0", widgetId: "day_view", position: { x: 0, y: 0 }, size: { cols: 2, rows: 1 } },
          ],
        },
      ],
    };

    const result = await saveDashboardConfigAction(config);

    expect(result.ok).toBe(false);
    expect(saveDashboardConfig).not.toHaveBeenCalled();
  });

  it("saves a config whose widgets are all available to the session's role", async () => {
    getSession.mockResolvedValue(session("client_owner"));
    saveDashboardConfig.mockResolvedValue(undefined);

    const config: DashboardConfig = {
      role: "client_owner",
      currentPage: 0,
      updatedAt: Date.now(),
      pages: [
        {
          id: "default",
          title: "Owner",
          widgets: [
            { id: "leads_funnel_0", widgetId: "leads_funnel", position: { x: 0, y: 0 }, size: { cols: 1, rows: 1 } },
          ],
        },
      ],
    };

    const result = await saveDashboardConfigAction(config);

    expect(result).toEqual({ ok: true });
    expect(saveDashboardConfig).toHaveBeenCalledWith("user-1", config);
  });

  it("still rejects on role mismatch before the widget check runs", async () => {
    getSession.mockResolvedValue(session("client_owner"));

    const config: DashboardConfig = {
      role: "client_closer",
      currentPage: 0,
      updatedAt: Date.now(),
      pages: [],
    };

    const result = await saveDashboardConfigAction(config);

    expect(result).toEqual({ ok: false, error: "Role mismatch" });
    expect(saveDashboardConfig).not.toHaveBeenCalled();
  });
});
