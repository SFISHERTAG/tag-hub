import { describe, expect, it } from "vitest";
import {
  resolveFields,
  canSee,
  columnsFor,
  project,
  visibilityOf,
} from "@/lib/dashboard/field-visibility";
import { FIELD_CATALOG } from "@/lib/dashboard/field-catalog.generated";
import type { Role } from "@/lib/auth/roles";

/**
 * Story 7.4. Every case here is a way a client could end up seeing TAG's
 * internal numbers, so each asserts the denial, not merely a defined result.
 */

const CLIENT_ROLES: Role[] = [
  "client_owner",
  "client_manager",
  "client_closer",
  "client_setter_manager",
  "client_setter",
];

/** Named in docs/client-fields.md §2 as the fields that must never reach a client. */
const MARGIN_FIELDS = ["contract.mrr", "econ.feeToSpendRatio"];

describe("margin never reaches a client role", () => {
  for (const role of CLIENT_ROLES) {
    for (const fieldId of MARGIN_FIELDS) {
      it(`${role} cannot see ${fieldId}`, () => {
        const allowlist = resolveFields(role);
        expect(canSee(allowlist, fieldId)).toBe(false);
        expect(columnsFor(allowlist, [fieldId])).toEqual([]);
        expect(project(allowlist, { [fieldId]: 99_999 })).toEqual({});
      });
    }
  }
});

describe("allowlist semantics", () => {
  it("a field absent from a role's map is denied, not defaulted on", () => {
    const field = { id: "x", label: "x", section: "x", visibility: {} };
    expect(visibilityOf(field, "client_closer")).toBe("never");
  });

  it("denies a field id that is not in the catalog at all", () => {
    const allowlist = resolveFields("tag_exec");
    expect(canSee(allowlist, "invented.field")).toBe(false);
    expect(project(allowlist, { "invented.field": 1 })).toEqual({});
  });

  it("columnsFor intersects rather than unions", () => {
    const allowlist = resolveFields("client_closer");
    const asked = ["client.name", "contract.mrr", "invented.field"];
    const got = columnsFor(allowlist, asked);
    expect(got).not.toContain("contract.mrr");
    expect(got).not.toContain("invented.field");
  });

  it("drops a forbidden key rather than throwing, so errors cannot probe for fields", () => {
    const allowlist = resolveFields("client_owner");
    expect(() => columnsFor(allowlist, ["contract.mrr"])).not.toThrow();
  });

  it("defaultOn is a subset of permitted for every role", () => {
    const roles = new Set<Role>();
    for (const f of Object.values(FIELD_CATALOG)) {
      for (const r of Object.keys(f.visibility)) roles.add(r as Role);
    }
    for (const role of roles) {
      const a = resolveFields(role);
      for (const id of a.defaultOn) expect(a.permitted.has(id)).toBe(true);
    }
  });

  it("project keeps permitted keys", () => {
    const allowlist = resolveFields("client_owner");
    const out = project(allowlist, { "client.name": "Acme", "contract.mrr": 5000 });
    expect(out).toEqual({ "client.name": "Acme" });
  });
});
