import { describe, expect, it } from "vitest";
import {
  canUseWidget,
  filterWidgetsForRole,
  WIDGET_REGISTRY,
} from "@/lib/dashboard/widget-definitions";
import type { DashboardConfig } from "@/lib/dashboard/widget-definitions";
import { ROLES } from "@/lib/auth/roles";

/**
 * Resweep critical 3: the saved dashboard layout is caller-supplied, and the
 * dashboard page fetches data for whatever widget ids it contains. Role
 * matching alone let a tag_setter save the owner's calendar or the closer's
 * pipeline board into their own layout and read live deal values on the next
 * load, so `availableFor` has to be enforced as a permission and not only as
 * a picker filter.
 */

function layout(widgetIds: string[]): DashboardConfig {
  return {
    role: "tag_setter",
    currentPage: 0,
    updatedAt: 0,
    pages: [
      {
        id: "page-1",
        title: "Overview",
        widgets: widgetIds.map((widgetId, i) => ({
          id: `w-${i}`,
          widgetId,
          position: { x: 0, y: i },
          size: { cols: 1, rows: 1 },
        })),
      },
    ],
  };
}

describe("canUseWidget", () => {
  it("refuses a widget the role is not listed for", () => {
    expect(canUseWidget("tag_setter", "owner_calendar")).toBe(false);
    expect(canUseWidget("tag_setter", "pipeline_board")).toBe(false);
  });

  it("allows a widget the role is listed for", () => {
    expect(canUseWidget("client_closer", "pipeline_board")).toBe(true);
  });

  it("refuses an unknown widget id rather than defaulting to allowed", () => {
    expect(canUseWidget("tag_exec", "not_a_widget")).toBe(false);
  });

  it("agrees with the registry for every role and widget", () => {
    for (const role of ROLES) {
      for (const [widgetId, def] of Object.entries(WIDGET_REGISTRY)) {
        expect(canUseWidget(role, widgetId)).toBe(def.availableFor.includes(role));
      }
    }
  });
});

describe("filterWidgetsForRole", () => {
  it("drops forbidden widgets and keeps the allowed ones", () => {
    const filtered = filterWidgetsForRole("client_closer", layout(["pipeline_board", "spend_roas"]));
    expect(filtered.pages[0].widgets.map((w) => w.widgetId)).toEqual(["pipeline_board"]);
  });

  it("degrades to an empty page rather than throwing on an all-forbidden layout", () => {
    // A layout can outlive a role change; that should lose widgets, not
    // render an error page.
    const filtered = filterWidgetsForRole("tag_setter", layout(["owner_calendar"]));
    expect(filtered.pages[0].widgets).toEqual([]);
  });

  it("leaves an already-valid layout untouched", () => {
    const config = layout(["pipeline_board"]);
    expect(filterWidgetsForRole("client_closer", config).pages[0].widgets).toEqual(
      config.pages[0].widgets,
    );
  });
});
