import { NextResponse, type NextRequest } from "next/server";
import { requireApiLocationAccess } from "@/lib/auth/api-session";
import { getSetterLeads, getSetterMetrics } from "@/lib/dashboard/speed-to-lead";
import { ROLES } from "@/lib/auth/roles";
import { badRequest, handle, requireApiRole, unwrap } from "../../admin/_lib/http";

export const dynamic = "force-dynamic";

const SETTER_ROLES = [ROLES.TAG_SETTER, ROLES.CLIENT_SETTER, ROLES.TAG_EXEC] as const;

/**
 * GET /api/setter/dashboard?locationId=<optional>
 *
 * 200: {
 *   locationId: string,
 *   setterEmail: string,
 *   refreshedAt: string,          // ISO 8601, when this response was built
 *   metrics: SetterMetrics,
 *   leads: LeadMetric[]           // createdAt / firstContactAt are ISO strings on the wire
 * }
 * 400: no location resolvable
 * 401/403: not signed in / not a setter / no access to that location
 * 502: the upstream (GHL) read failed
 *
 * The speed-to-lead board, both for first load and for polling. One endpoint
 * for both so a refresh cannot drift from what the page was seeded with.
 *
 * Two things are deliberate.
 *
 * **The setter is the session, not a parameter.** The email passed to
 * `getSetterMetrics` / `getSetterLeads` comes from `session.email`. The
 * original design had the client POST a `setterEmail`, which would have let
 * any caller pull any setter's queue. `locationId` is accepted as a query
 * parameter but is never trusted: `requireApiLocationAccess` re-checks it
 * against the session, including the CSM impersonation path.
 *
 * **A failed read is a 502, not an empty board.** The dashboard used to poll a
 * route that did not exist; every refresh 404'd, `response.ok` was false, the
 * catch did nothing, and the page sat frozen on its load-time data with
 * nothing on screen to say so. On a board whose entire purpose is the
 * two-minute window, a silently frozen queue is worse than no queue. So an
 * upstream failure returns 502 with a typed body and never a 200 carrying
 * zeros, which is what lets the client keep its last-good data and show a
 * staleness warning instead of rendering "0 leads today" over a real backlog.
 * `refreshedAt` is what that warning counts from.
 */
export async function GET(request: NextRequest) {
  const context = "GET /api/setter/dashboard";

  return handle(context, async () => {
    const gate = await requireApiRole(SETTER_ROLES, context);
    if (!gate.ok) return gate.response;

    const requested = new URL(request.url).searchParams.get("locationId");
    const locationId = (requested ?? gate.session.locations[0] ?? "").trim();
    if (!locationId) {
      throw badRequest("No client account is available for this login.");
    }

    const access = await requireApiLocationAccess(locationId, context);
    if (!access.ok) return access.response;

    const email = access.session.email ?? "";

    const [metricsResult, leadsResult] = await Promise.all([
      getSetterMetrics(locationId, email),
      getSetterLeads(locationId, email),
    ]);

    return NextResponse.json({
      locationId,
      setterEmail: email,
      refreshedAt: new Date().toISOString(),
      metrics: unwrap(metricsResult),
      leads: unwrap(leadsResult),
    });
  });
}
