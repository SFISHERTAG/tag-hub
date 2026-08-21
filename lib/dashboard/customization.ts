/* eslint-disable import/no-restricted-paths -- Predates the metric registry.
   Queries directly instead of going through a scoped metric fetch. Not a leak
   today (nothing here is per-user), but it is the pattern the zone exists to
   stop, so this comment is the migration marker: move the data path into
   lib/dashboard/metrics.ts and delete this line. See docs/ROLE_SCOPE_MODEL.md. */
import "server-only";
import { pool } from "@/lib/postgres";
import type { Role } from "@/lib/auth/roles";
import type { DashboardConfig, DashboardPage, WidgetDefinition } from "./widget-definitions";
import { WIDGET_REGISTRY, getAvailableWidgets } from "./widget-definitions";

/**
 * Dashboard customization, stored in Postgres rather than Firestore.
 *
 * A user's layout for one role has no relationship to GHL or Firebase auth
 * data — it is pure UI preference — so it does not need to live next to
 * tenant or session state. Keeping it in the same `tag_automation` database
 * `phase3-status.ts` already reads also avoids importing the Firestore Admin
 * SDK (and its Node-only transport deps) into any code path a client
 * component might end up pulling in.
 */

export async function loadDashboardConfig(uid: string, role: Role): Promise<DashboardConfig> {
  try {
    const result = await pool.query(
      `SELECT role, pages, current_page, updated_at
       FROM dashboard_configs
       WHERE uid = $1 AND role = $2`,
      [uid, role],
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      const config: DashboardConfig = {
        role: row.role,
        pages: row.pages,
        currentPage: row.current_page,
        updatedAt: new Date(row.updated_at).getTime(),
      };
      if (isDashboardConfig(config)) return config;
    }
  } catch (error) {
    console.error("Error loading dashboard config:", error);
  }

  // Return default config if not found, invalid, or on error
  return createDefaultConfig(role);
}

export async function saveDashboardConfig(uid: string, config: DashboardConfig): Promise<void> {
  await pool.query(
    `INSERT INTO dashboard_configs (uid, role, pages, current_page, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (uid, role)
     DO UPDATE SET pages = $3, current_page = $4, updated_at = NOW()`,
    [uid, config.role, JSON.stringify(config.pages), config.currentPage],
  );
}

function isDashboardConfig(data: unknown): data is DashboardConfig {
  return (
    typeof data === "object" &&
    data !== null &&
    "role" in data &&
    "pages" in data &&
    Array.isArray((data as Record<string, unknown>).pages)
  );
}

/**
 * Create a default dashboard config for a role.
 * Provides sensible defaults based on the role.
 */
function createDefaultConfig(role: Role): DashboardConfig {
  const availableWidgets = getAvailableWidgets(role);

  // Create default pages based on role
  const defaultPages = getDefaultPagesForRole(role, availableWidgets.map((w) => w.id));

  return {
    role,
    pages: defaultPages,
    currentPage: 0,
    updatedAt: Date.now(),
  };
}

function getDefaultPagesForRole(role: Role, availableWidgetIds: string[]): DashboardPage[] {
  // Create a simple grid layout for available widgets
  // Put them on a single default page; user can customize later

  const widgets = availableWidgetIds.map((id, index) => {
    const widget = WIDGET_REGISTRY[id];
    if (!widget) return null;

    // Simple grid: 2 columns, arrange widgets left-to-right
    const col = (index % 2) * 2;
    const row = Math.floor(index / 2) * widget.defaultSize.rows;

    return {
      id: `${id}_0`,
      widgetId: id,
      position: { x: col, y: row },
      size: widget.defaultSize,
    };
  }).filter((w) => w !== null) as DashboardPage["widgets"];

  return [
    {
      id: "default",
      title: roleLabel(role),
      widgets,
    },
  ];
}

function roleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    admin: "Admin",
    tag_exec: "Executive",
    tag_csd: "CS Director",
    tag_csm: "Client Services",
    tag_sales_manager: "Sales Manager",
    tag_sales: "Sales",
    tag_setter_manager: "Setter Manager",
    tag_setter: "Setter",
    client_owner: "Owner",
    client_manager: "Closing Manager",
    client_closer: "Closer",
    client_setter_manager: "Setter Manager",
    client_setter: "Setter",
  };
  return labels[role] || role;
}
