import { describe, expect, it } from "vitest";
import { clientOwnerGrants } from "../functions/src/auth";
import { ROLES, ROLE_LIST, isRole } from "@/lib/auth/roles";

/**
 * The founder's grant. Every assertion here is a way this could hand a client
 * more than their own tenancy, or drop them into the wrong first screen.
 */

const LOCATION = "loc-abc";

/** Named constant rather than a literal — ROLES is the single source of truth. */
const OWNER_ROLE = ROLES.CLIENT_OWNER;

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
    const forbidden = ROLE_LIST.filter((r) => !r.startsWith("client_"));
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
    expect(byRole[ROLES.CLIENT_CLOSER]).toBe("self");
    expect(byRole[ROLES.CLIENT_SETTER]).toBe("self");
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
  const staff = { role: ROLES.TAG_CSM, locations: ["loc-a", "loc-b"], scope: "tenancy" as const };

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

  it("matches a grant in place rather than duplicating it, and keeps its scope", () => {
    // This pin used to expect the opposite: an existing scope "self" was
    // called stale and re-provisioning was expected to heal it to the owner
    // default. That was right when provisioning was the ONLY writer of scope.
    // Story 7.7 made the admin UI a writer too, and provisioning cannot tell
    // a stale value from a chosen one — so "healing" became the bug where a
    // webhook retry silently undid an admin's override. The existing explicit
    // scope now wins; only a grant with no scope at all gets the default.
    const chosen = { role: OWNER_ROLE, locations: [LOCATION], scope: "self" as const };
    const merged = mergeGrants([chosen], clientOwnerGrants(LOCATION));
    const owners = merged.filter((g) => g.role === OWNER_ROLE);
    expect(owners.length).toBe(1);
    expect(owners[0].scope).toBe("self");
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
