import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/api-session";
import { getOwnerCalendar, type OwnerCalendarResult } from "@/lib/dashboard/owner-calendar";
import { requireWidget, resolveDashboardLocation } from "../../_lib/access";
import { handle } from "../../_lib/http";
import { NO_LOCATION_WARNING, type WidgetWarning } from "../../_lib/widget-payload";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/dashboard/widgets/owner-calendar";

export type OwnerCalendarResponse = { calendar: OwnerCalendarResult; warnings: WidgetWarning[] };

/**
 * GET /api/dashboard/widgets/owner-calendar
 *
 * Port of the `owner_calendar` fetch. `calendar.scoped === false` means the
 * tenant has no `ownerGhlUserId`, so the whole location's calendar is shown
 * rather than one person's — surface that, it changes what the view means.
 */
export async function GET(): Promise<NextResponse> {
  return handle(CONTEXT, async () => {
    const gate = await requireApiSession(CONTEXT);
    if (!gate.ok) return gate.response;
    const { session } = gate;
    requireWidget(session, "owner_calendar");

    const locationId = resolveDashboardLocation(session);
    if (!locationId) {
      const body: OwnerCalendarResponse = {
        calendar: { ok: false, message: "No GHL location configured yet." },
        warnings: [NO_LOCATION_WARNING],
      };
      return NextResponse.json(body);
    }

    const body: OwnerCalendarResponse = {
      calendar: await getOwnerCalendar(locationId),
      warnings: [],
    };
    return NextResponse.json(body);
  });
}
