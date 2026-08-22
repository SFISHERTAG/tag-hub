import { describe, expect, it } from "vitest";
import { clientOwnerGrants, mergeGrants } from "./auth";

// Role names come from clientOwnerGrants itself, not literals: this workspace
// cannot import lib/auth/role-labels (the structural exemption the pre-commit
// role check documents), and deriving them from the function under test keys
// the fixtures to exactly what provisioning issues.
const GRANTS = clientOwnerGrants("loc-a");
const OWNER = GRANTS[0].role;
const MANAGER = GRANTS[1].role;
const CLOSER = GRANTS[2].role;

/**
 * mergeGrants is where re-provisioning meets grants an admin has edited by
 * hand. The 2026-08-22 review found it replacing a matched grant wholesale
 * with the incoming default, which deleted two things the incoming grant
 * cannot carry: the team an admin set through Story 7.7's UI (the type here
 * had no team field at all), and any extra locations the existing grant
 * spanned. Re-provisioning is a documented retry path, so "webhook re-ran"
 * must never mean "admin's work undone".
 */
describe("mergeGrants preserves what re-provisioning cannot know", () => {
  it("keeps an admin-set scope override on a matched grant", () => {
    const existing = [
      { role: MANAGER, locations: ["loc-a"], scope: "tenancy" as const },
    ];
    const merged = mergeGrants(existing, clientOwnerGrants("loc-a"));
    const manager = merged.find((g) => g.role === MANAGER);
    expect(manager?.scope).toBe("tenancy");
  });

  it("keeps an admin-set team on a matched grant", () => {
    const existing = [
      {
        role: MANAGER,
        locations: ["loc-a"],
        scope: "team" as const,
        team: ["uid-b", "uid-c"],
      },
    ];
    const merged = mergeGrants(existing, clientOwnerGrants("loc-a"));
    const manager = merged.find((g) => g.role === MANAGER);
    expect(manager?.team).toEqual(["uid-b", "uid-c"]);
  });

  it("keeps the other locations of a multi-tenancy grant", () => {
    const existing = [{ role: CLOSER, locations: ["loc-a", "loc-b"] }];
    const merged = mergeGrants(existing, [
      { role: CLOSER, locations: ["loc-a"], scope: "self" },
    ]);
    const closer = merged.find((g) => g.role === CLOSER);
    expect(closer?.locations).toEqual(["loc-a", "loc-b"]);
  });

  it("backfills scope onto a pre-scope grant that never had one", () => {
    const existing = [{ role: CLOSER, locations: ["loc-a"] }];
    const merged = mergeGrants(existing, [
      { role: CLOSER, locations: ["loc-a"], scope: "self" },
    ]);
    expect(merged.find((g) => g.role === CLOSER)?.scope).toBe("self");
  });

  it("still appends a genuinely new grant, and a second tenancy stays additive", () => {
    const existing = [{ role: OWNER, locations: ["loc-a"], scope: "tenancy" as const }];
    const merged = mergeGrants(existing, clientOwnerGrants("loc-b"));
    const owner = merged.filter((g) => g.role === OWNER);
    expect(owner).toHaveLength(2);
    expect(owner.map((g) => g.locations)).toEqual([["loc-a"], ["loc-b"]]);
  });
});
