import { describe, expect, it } from "vitest";
import { clientOwnerGrants } from "../functions/src/auth";
import { ROLES, isRole } from "@/lib/auth/roles";

/**
 * The founder's grant. Every assertion here is a way this could hand a client
 * more than their own tenancy, or drop them into the wrong first screen.
 */

const LOCATION = "loc-abc";

/** Read from ROLES rather than typed inline — see the exemption note below. */
const OWNER_ROLE = ROLES.find((r) => r === "client_owner")!;

describe("clientOwnerGrants", () => {
  const grants = clientOwnerGrants(LOCATION);

  it("puts client_owner first, since a new user has no hat cookie", () => {
    expect(grants[0].role).toBe(OWNER_ROLE);
  });

  it("grants only client_* roles", () => {
    for (const g of grants) expect(g.role.startsWith("client_")).toBe(true);
  });

  it("never grants a TAG-side or admin role", () => {
    // Derived from ROLES rather than a hand-written list, so a role added to
    // the codebase later is covered here without anyone remembering.
    const forbidden = ROLES.filter((r) => !r.startsWith("client_"));
    for (const g of grants) expect(forbidden).not.toContain(g.role);
  });

  it("scopes every grant to exactly this one location", () => {
    for (const g of grants) expect(g.locations).toEqual([LOCATION]);
  });

  it("never uses the empty-locations wildcard", () => {
    // [] means *all* locations at session build — the opposite of none.
    for (const g of grants) expect(g.locations.length).toBeGreaterThan(0);
  });

  it("only issues roles that actually exist in lib's ROLES", () => {
    // This is what earns functions/src/auth.ts its exemption in
    // scripts/check-story-status.mjs: the functions runtime cannot import the
    // role definitions, so drift is caught here instead.
    for (const g of grants) expect(isRole(g.role)).toBe(true);
  });

  it("gives the owner hat tenancy scope and the IC hats self scope", () => {
    const byRole = Object.fromEntries(grants.map((g) => [g.role, g.scope]));
    expect(byRole[OWNER_ROLE]).toBe("tenancy");
    expect(byRole.client_closer).toBe("self");
    expect(byRole.client_setter).toBe("self");
  });

  it("issues no duplicate roles", () => {
    const roles = grants.map((g) => g.role);
    expect(new Set(roles).size).toBe(roles.length);
  });

  it("is deterministic for the same location", () => {
    expect(clientOwnerGrants(LOCATION)).toEqual(grants);
  });

  it("does not leak one location into another's grants", () => {
    const other = clientOwnerGrants("loc-xyz");
    for (const g of other) expect(g.locations).not.toContain(LOCATION);
  });
});

import { mergeGrants } from "../functions/src/auth";

/**
 * Re-provisioning must not remove access somebody already has. A TAG staffer
 * who is also an owner at a client, or anyone provisioned for a second
 * tenancy, are both real cases.
 */
describe("mergeGrants", () => {
  const staffRole = ROLES.find((r) => r.startsWith("tag_"))!;
  const staff = { role: staffRole, locations: ["loc-a", "loc-b"], scope: "tenancy" as const };

  it("keeps unrelated existing grants", () => {
    const merged = mergeGrants([staff], clientOwnerGrants("loc-new"));
    expect(merged).toContainEqual(staff);
  });

  it("is idempotent — re-provisioning the same client adds nothing", () => {
    const once = mergeGrants([], clientOwnerGrants(LOCATION));
    const twice = mergeGrants(once, clientOwnerGrants(LOCATION));
    expect(twice).toEqual(once);
  });

  it("is additive across tenancies rather than replacing", () => {
    const first = mergeGrants([], clientOwnerGrants("loc-1"));
    const both = mergeGrants(first, clientOwnerGrants("loc-2"));
    expect(both.length).toBe(first.length * 2);
    expect(both.filter((g) => g.role === OWNER_ROLE).length).toBe(2);
  });

  it("updates a matching grant in place rather than duplicating it", () => {
    const stale = { role: OWNER_ROLE, locations: [LOCATION], scope: "self" as const };
    const merged = mergeGrants([stale], clientOwnerGrants(LOCATION));
    const owners = merged.filter((g) => g.role === OWNER_ROLE);
    expect(owners.length).toBe(1);
    expect(owners[0].scope).toBe("tenancy");
  });

  it("does not mutate the arrays it is given", () => {
    const existing = [staff];
    const snapshot = JSON.parse(JSON.stringify(existing));
    mergeGrants(existing, clientOwnerGrants(LOCATION));
    expect(existing).toEqual(snapshot);
  });

  it("tolerates a malformed existing grant with no locations", () => {
    const broken = { role: clientOwnerGrants(LOCATION)[2].role } as unknown as {
      role: string;
      locations: string[];
    };
    expect(() => mergeGrants([broken], clientOwnerGrants(LOCATION))).not.toThrow();
  });
});
