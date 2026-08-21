import { describe, expect, it } from "vitest";
import {
  WIDGET_REGISTRY,
  getAvailableWidgets,
  isOfferable,
  type WidgetDefinition,
} from "@/lib/dashboard/widget-definitions";
import { FIELD_CATALOG } from "@/lib/dashboard/field-catalog.generated";
import { canSee, resolveFields } from "@/lib/dashboard/field-visibility";
// role-labels, not roles: the latter is `server-only` and this file needs the
// identifiers themselves, not the hat-cookie logic layered on top of them.
import { ROLES, ROLE_LIST, type Role } from "@/lib/auth/role-labels";

/**
 * Story 7.4, the picker half. `resolveFields` decided which *columns* a hat may
 * read; until now the customize picker offered widgets on `availableFor` alone,
 * so the two could disagree and only the widget list was visible to a user.
 *
 * That was not hypothetical: `kpi_summary` renders spend, ROAS and cost per
 * lead, and was offered to `client_manager`, whom docs/client-fields.md marks
 * `never` on all three.
 */

const CLIENT_ROLES: Role[] = [
  ROLES.CLIENT_OWNER,
  ROLES.CLIENT_MANAGER,
  ROLES.CLIENT_CLOSER,
  ROLES.CLIENT_SETTER_MANAGER,
  ROLES.CLIENT_SETTER,
];

/** Named in docs/client-fields.md §2 as the fields that must never reach a client. */
const MARGIN_FIELDS = ["contract.mrr", "econ.feeToSpendRatio"];

describe("widget field declarations", () => {
  for (const widget of Object.values(WIDGET_REGISTRY)) {
    it(`${widget.id} declares only fields that exist in the catalog`, () => {
      const unknown = widget.fields.filter((id) => !FIELD_CATALOG[id]);
      expect(unknown).toEqual([]);
    });
  }

  /**
   * An empty declaration is legal and correct for a widget with no catalog
   * data, but it is also how this check gets hollowed out one widget at a time.
   * Every widget in the registry today names at least one field; if that stops
   * being true, it should be a decision someone made, not a drift nobody saw.
   */
  it("every widget in the registry declares at least one field", () => {
    const silent = Object.values(WIDGET_REGISTRY).filter((w) => w.fields.length === 0);
    expect(silent.map((w) => w.id)).toEqual([]);
  });
});

describe("the picker never offers a widget a hat cannot fully see", () => {
  for (const role of ROLE_LIST) {
    it(`${role} is offered nothing it lacks a field for`, () => {
      const allowlist = resolveFields(role);
      for (const widget of getAvailableWidgets(role)) {
        const hidden = widget.fields.filter((id) => !canSee(allowlist, id));
        expect(hidden).toEqual([]);
      }
    });
  }

  it("drops a widget rather than trimming it", () => {
    // client_manager may see funnel.bookingRate, one of kpi_summary's four
    // fields. Partial visibility is not partial offering: the widget is absent.
    const managerAllowlist = resolveFields(ROLES.CLIENT_MANAGER);
    expect(canSee(managerAllowlist, "funnel.bookingRate")).toBe(true);
    expect(canSee(managerAllowlist, "spend.actual")).toBe(false);
    expect(getAvailableWidgets(ROLES.CLIENT_MANAGER).map((w) => w.id)).not.toContain(
      "kpi_summary",
    );
  });

  it("still offers kpi_summary to the owner, who may see cost", () => {
    expect(getAvailableWidgets(ROLES.CLIENT_OWNER).map((w) => w.id)).toContain("kpi_summary");
  });
});

/**
 * The registry happens to be consistent today: every widget's role list already
 * agrees with its fields, so removing the field check from `getAvailableWidgets`
 * changes nothing a registry-driven test can see. That makes the tests above a
 * check on the registry, not on the rule.
 *
 * These cases are the rule itself, exercised against a widget that does not
 * exist — the widget someone adds next year that renders margin and is marked
 * available to an owner. That is the case the whole story is written against.
 */
describe("the offering rule, on a widget the registry does not contain", () => {
  const marginWidget: WidgetDefinition = {
    id: "margin_leak",
    title: "Fee vs Spend",
    availableFor: [ROLES.CLIENT_OWNER, ROLES.TAG_EXEC],
    defaultSize: { cols: 1, rows: 1 },
    fields: ["spend.actual", "econ.feeToSpendRatio"],
  };

  it("refuses a widget whose fields the hat cannot see, despite availableFor", () => {
    expect(marginWidget.availableFor).toContain(ROLES.CLIENT_OWNER);
    expect(
      isOfferable(marginWidget, ROLES.CLIENT_OWNER, resolveFields(ROLES.CLIENT_OWNER)),
    ).toBe(false);
  });

  it("still offers it to the hat that may see every field", () => {
    expect(isOfferable(marginWidget, ROLES.TAG_EXEC, resolveFields(ROLES.TAG_EXEC))).toBe(true);
  });

  it("refuses a hat the widget never listed, even with every field visible", () => {
    expect(isOfferable(marginWidget, ROLES.TAG_CSM, resolveFields(ROLES.TAG_CSM))).toBe(false);
  });

  it("refuses a field id that is not in the catalog at all", () => {
    const unknownField: WidgetDefinition = {
      ...marginWidget,
      id: "unclassified",
      fields: ["spend.actual", "spend.notAFieldAnyoneClassified"],
    };
    expect(
      isOfferable(unknownField, ROLES.TAG_EXEC, resolveFields(ROLES.TAG_EXEC)),
    ).toBe(false);
  });
});

describe("no client hat is offered a widget carrying TAG's numbers", () => {
  for (const role of CLIENT_ROLES) {
    it(`${role} is offered no widget declaring a margin field`, () => {
      const leaks = getAvailableWidgets(role).filter((w) =>
        w.fields.some((id) => MARGIN_FIELDS.includes(id)),
      );
      expect(leaks.map((w) => w.id)).toEqual([]);
    });
  }
});

/**
 * `tag_csd` had no column in docs/client-fields.md, so `resolveFields` denied it
 * every field while three widgets were still offered to it. A CS Director's
 * dashboard would have emptied the moment the picker consulted the allowlist.
 * The doc now carries a `TCD` column, and these are the widgets that depend on
 * it staying there.
 */
describe("every role with widgets has a column in the doc", () => {
  it("tag_csd keeps its three widgets", () => {
    const offered = getAvailableWidgets(ROLES.TAG_CSD).map((w) => w.id);
    expect(offered).toContain("client_health");
    expect(offered).toContain("portfolio");
    expect(offered).toContain("team_health_rollup");
  });

  it("no role is offered widgets while permitted zero fields", () => {
    const starved = ROLE_LIST.filter(
      (role) =>
        resolveFields(role).permitted.size === 0 &&
        Object.values(WIDGET_REGISTRY).some((w) => w.availableFor.includes(role)),
    );
    expect(starved).toEqual([]);
  });
});
