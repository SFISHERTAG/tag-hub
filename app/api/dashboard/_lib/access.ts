import "server-only";
import type { Session } from "@/lib/auth/session";
import { hasAnyRole, ROLES, type Role } from "@/lib/auth/roles";
import { WIDGET_REGISTRY, type WidgetDefinition } from "@/lib/dashboard/widget-definitions";
import {
  DashboardLocationError,
  getLocationForDashboard,
} from "@/lib/dashboard/location-selection";
import { postAlert, slackConfigured } from "@/lib/slack";
import { forbidden, notFound } from "./http";

/**
 * Access rules for the dashboard and client-book endpoints.
 *
 * Nothing here invents a rule. Session and location checks come from
 * lib/auth/api-session.ts; role checks come from lib/auth/roles.ts; widget
 * entitlement comes from each widget's own `availableFor` list. This module
 * only chooses which existing rule an endpoint runs.
 */

/**
 * The staff roles that may read any client record or any CSM's book.
 *
 * Port of legacy/csm-dashboard/actions/access.ts#CSM_DASHBOARD_ROLES, kept
 * identical on purpose. The boundary is staff vs. client-facing, NOT per-CSM
 * ownership — see the "jump in and help" coverage design documented on
 * `getClientsForCsm` in lib/dashboard/csm-clients.ts. Narrowing it here would
 * silently remove coverage, so it stays exactly where the reference
 * implementation put it.
 */
export const CSM_BOOK_ROLES: readonly Role[] = [
  ROLES.TAG_CSM,
  ROLES.TAG_CSD,
  ROLES.TAG_EXEC,
  ROLES.ADMIN,
];

/** Roles whose book spans more than their own assignments. */
export const CROSS_BOOK_ROLES: readonly Role[] = [ROLES.TAG_CSD, ROLES.TAG_EXEC, ROLES.ADMIN];

/**
 * Widget entitlement, enforced on every data read.
 *
 * `availableFor` is a permission, not a picker filter. The reference
 * implementation checks it in three separate places for that reason — the save
 * action (legacy/dashboard/customize/actions.ts), the read path
 * (legacy/dashboard/page.tsx#canUseWidget) and the picker — because a config
 * saved while a user held a role is what drives the fetch after they lose it.
 * Every widget data endpoint in this story calls this before touching lib/.
 */
export function requireWidget(session: Session, widgetId: string): WidgetDefinition {
  const definition = WIDGET_REGISTRY[widgetId];
  if (!definition) throw notFound(`Unknown widget "${widgetId}".`);
  if (!hasAnyRole(session.currentRole, definition.availableFor)) {
    throw forbidden(`Widget "${widgetId}" is not available for your current role.`);
  }
  return definition;
}

/** True when this role may currently use this widget. Used to filter a saved layout on read. */
export function canUseWidget(session: Session, widgetId: string): boolean {
  const definition = WIDGET_REGISTRY[widgetId];
  if (!definition) return false;
  return hasAnyRole(session.currentRole, definition.availableFor);
}

/**
 * The GHL location a dashboard widget reads.
 *
 * Derived from the session and never accepted from the caller. That is the
 * whole defence: no dashboard endpoint in this story takes a locationId, so
 * there is nothing to fail to check. Resolution can throw for a role/session
 * shape it does not recognise (no TAG_GROWTH env, client role with no assigned
 * location); that degrades to "no location" exactly as
 * legacy/dashboard/page.tsx did, rather than failing the request.
 */
/**
 * Alert throttle.
 *
 * A config fault fires on every dashboard request from every internal user
 * across four widget routes, so alerting per occurrence would post hundreds of
 * identical messages and train everyone to mute the channel. One per fault kind
 * per window is enough: the condition is a missing environment variable, so it
 * is either true or false, and repeating it adds nothing.
 *
 * Deliberately in-process and not persisted. A restart re-alerting once is the
 * correct behaviour, since a restart is exactly when a config fault would have
 * been introduced or fixed.
 */
const ALERT_WINDOW_MS = 15 * 60 * 1000;
const lastAlertedAt = new Map<string, number>();

function shouldAlert(key: string, now: number): boolean {
  const previous = lastAlertedAt.get(key);
  if (previous !== undefined && now - previous < ALERT_WINDOW_MS) return false;
  lastAlertedAt.set(key, now);
  return true;
}

export function resolveDashboardLocation(session: Session): string | null {
  try {
    return getLocationForDashboard(session) || null;
  } catch (error) {
    // "unassigned" is a data state a client role can legitimately be in, and
    // sample data answers it. Anything else means this deployment cannot read
    // its own configuration, which is not the user's problem and not something
    // they can see: the response still renders, just with fabricated numbers.
    // That silence is the harm, and it is why this escalates before returning.
    const kind = error instanceof DashboardLocationError ? error.kind : "unknown";

    if (kind !== "unassigned") {
      const detail =
        kind === "config"
          ? "GHL_LOCATION_ID_TAG_GROWTH is not set"
          : `unexpected: ${error instanceof Error ? error.message : String(error)}`;

      console.error("[dashboard] location resolution failed:", detail);

      if (slackConfigured() && shouldAlert(kind, Date.now())) {
        void postAlert(
          `Dashboard location resolution is failing (${detail}). Every internal ` +
            `user's leads-funnel, spend-roas, pipeline-board and kpi-summary tiles ` +
            `are serving sample data instead of live figures. The tiles disclose ` +
            `this to the viewer; nothing was alerting TAG until now.`,
        ).catch(() => {
          // Alerting must never be the reason a dashboard request fails.
        });
      }
    }

    return null;
  }
}
