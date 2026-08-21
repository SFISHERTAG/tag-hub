import { NextResponse, type NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/api-session";
import { loadDashboardConfig, saveDashboardConfig } from "@/lib/dashboard/customization";
import {
  getAvailableWidgets,
  WIDGET_REGISTRY,
  type DashboardConfig,
  type DashboardPage,
  type WidgetDefinition,
} from "@/lib/dashboard/widget-definitions";
import { getLastUpdated, type LastUpdated } from "@/lib/dashboard/freshness";
import { canUseWidget, resolveDashboardLocation } from "../_lib/access";
import { forbidden, handle } from "../_lib/http";
import { parseDashboardConfig } from "../_lib/config-parse";
import { SAMPLE_DATA_WIDGET_IDS } from "../_lib/sample-data";

export const dynamic = "force-dynamic";

const GET_CONTEXT = "GET /api/dashboard/config";
const PUT_CONTEXT = "PUT /api/dashboard/config";

export type DashboardConfigResponse = {
  /** Entitlement-filtered. Never contains a widget this role may not use. */
  config: DashboardConfig;
  /** Resolved from `?page=`, falling back to the saved current page. */
  currentPageId: string | null;
  availableWidgets: WidgetDefinition[];
  /** Widget ids dropped from the saved layout because this role lost access to them. */
  removedWidgetIds: string[];
  /** Widget ids whose data is fabricated — render a sample-data notice on these. */
  sampleDataWidgetIds: readonly string[];
  /** Session-derived GHL location backing the location-scoped widgets, or null. */
  locationId: string | null;
  lastUpdated: LastUpdated;
};

/**
 * GET /api/dashboard/config
 *
 * The dashboard shell's single page-load call: layout, picker options,
 * location and freshness. Port of legacy/dashboard/page.tsx's server work
 * minus the per-widget fetches, which are their own endpoints under
 * /api/dashboard/widgets/*.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return handle(GET_CONTEXT, async () => {
    const gate = await requireApiSession(GET_CONTEXT);
    if (!gate.ok) return gate.response;
    const { session } = gate;

    const saved = await loadDashboardConfig(session.uid, session.currentRole);

    // Entitlement enforced ON READ, not only on save. A layout saved while the
    // user held a role outlives that role: the row in dashboard_configs is what
    // drives the fetch, so a widget they can no longer use has to be dropped
    // here or it renders with live data on the next load. This is the read half
    // of the same check legacy/dashboard/page.tsx did per widget.
    const removedWidgetIds: string[] = [];
    const pages: DashboardPage[] = saved.pages.map((page) => ({
      ...page,
      widgets: page.widgets.filter((placement) => {
        if (canUseWidget(session, placement.widgetId)) return true;
        removedWidgetIds.push(placement.widgetId);
        return false;
      }),
    }));

    const config: DashboardConfig = { ...saved, pages };

    // `?page=<id>` selects a tab. An unknown or absent id falls back to the
    // saved current page rather than erroring, so a stale bookmark degrades
    // instead of breaking — same rule as the reference implementation.
    const requestedPageId = request.nextUrl.searchParams.get("page");
    const currentPageId =
      pages.find((p) => p.id === requestedPageId)?.id ??
      pages[config.currentPage]?.id ??
      pages[0]?.id ??
      null;

    const locationId = resolveDashboardLocation(session);

    // Freshness failing is not a reason to fail the dashboard.
    const lastUpdated: LastUpdated = locationId
      ? await getLastUpdated(locationId).catch(() => ({ timestamp: null, source: null }))
      : { timestamp: null, source: null };

    const body: DashboardConfigResponse = {
      config,
      currentPageId,
      availableWidgets: getAvailableWidgets(session.currentRole),
      removedWidgetIds: [...new Set(removedWidgetIds)],
      sampleDataWidgetIds: SAMPLE_DATA_WIDGET_IDS,
      locationId,
      lastUpdated,
    };

    return NextResponse.json(body);
  });
}

export type DashboardConfigSaveResponse = { ok: true; config: DashboardConfig };

/**
 * PUT /api/dashboard/config
 *
 * Port of legacy/dashboard/customize/actions.ts#saveDashboardConfigAction.
 *
 * This is the entitlement boundary, not the picker. The picker is UI
 * convenience; without the check below a caller could save any widgetId
 * regardless of its `availableFor` list and have it rendered with live data on
 * the next load.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  return handle(PUT_CONTEXT, async () => {
    const gate = await requireApiSession(PUT_CONTEXT);
    if (!gate.ok) return gate.response;
    const { session } = gate;

    const config = parseDashboardConfig(await request.json().catch(() => null));

    // A layout belongs to one (uid, role) pair. Saving under a role the caller
    // is not currently wearing would let one hat rewrite another's dashboard.
    if (config.role !== session.currentRole) {
      throw forbidden(
        "Role mismatch: a layout can only be saved for the role currently being worn.",
      );
    }

    const allowed = new Set(getAvailableWidgets(config.role).map((w) => w.id));
    for (const page of config.pages) {
      for (const placement of page.widgets) {
        if (!WIDGET_REGISTRY[placement.widgetId] || !allowed.has(placement.widgetId)) {
          throw forbidden(`Widget "${placement.widgetId}" is not available for this role.`);
        }
      }
    }

    await saveDashboardConfig(session.uid, config);

    const body: DashboardConfigSaveResponse = { ok: true, config };
    return NextResponse.json(body);
  });
}
