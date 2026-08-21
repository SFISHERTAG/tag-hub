import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/api-session";
import { getAvailableWidgets, type WidgetDefinition } from "@/lib/dashboard/widget-definitions";
import { handle } from "../_lib/http";
import { SAMPLE_DATA_WIDGET_IDS } from "../_lib/sample-data";

export const dynamic = "force-dynamic";

const CONTEXT = "GET /api/dashboard/widgets";

export type AvailableWidgetsResponse = {
  role: string;
  widgets: WidgetDefinition[];
  /** Ids whose data is fabricated. The picker should label these before a user adds one. */
  sampleDataWidgetIds: readonly string[];
};

/**
 * GET /api/dashboard/widgets
 *
 * The customize picker's options, for the role currently being worn. This is a
 * convenience list, NOT the entitlement boundary — PUT /api/dashboard/config
 * re-derives the same set and rejects anything outside it, and every widget
 * data endpoint checks `availableFor` again before fetching.
 */
export async function GET(): Promise<NextResponse> {
  return handle(CONTEXT, async () => {
    const gate = await requireApiSession(CONTEXT);
    if (!gate.ok) return gate.response;

    const body: AvailableWidgetsResponse = {
      role: gate.session.currentRole,
      widgets: getAvailableWidgets(gate.session.currentRole),
      sampleDataWidgetIds: SAMPLE_DATA_WIDGET_IDS,
    };
    return NextResponse.json(body);
  });
}
