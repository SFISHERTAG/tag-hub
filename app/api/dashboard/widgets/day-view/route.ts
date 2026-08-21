import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/api-session";
import { getTodayCalls, type DayViewResult } from "@/lib/dashboard/day-view";
import { requireWidget, resolveDashboardLocation } from "../../_lib/access";
import { handle } from "../../_lib/http";
import { NO_LOCATION_WARNING, type WidgetWarning } from "../../_lib/widget-payload";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/dashboard/widgets/day-view";

export type DayViewResponse = { dayView: DayViewResult; warnings: WidgetWarning[] };

/**
 * GET /api/dashboard/widgets/day-view
 *
 * Port of the `day_view` fetch. No sample fallback exists for this widget in
 * the reference implementation and none is invented here — an empty schedule
 * and an unreachable calendar are different states, and `DayViewResult`
 * already distinguishes them.
 */
export async function GET(): Promise<NextResponse> {
  return handle(CONTEXT, async () => {
    const gate = await requireApiSession(CONTEXT);
    if (!gate.ok) return gate.response;
    const { session } = gate;
    requireWidget(session, "day_view");

    const locationId = resolveDashboardLocation(session);
    if (!locationId) {
      const body: DayViewResponse = {
        dayView: { ok: false, message: "No GHL location configured yet." },
        warnings: [NO_LOCATION_WARNING],
      };
      return NextResponse.json(body);
    }

    const body: DayViewResponse = { dayView: await getTodayCalls(locationId), warnings: [] };
    return NextResponse.json(body);
  });
}
