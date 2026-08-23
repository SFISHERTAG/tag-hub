import { describe, expect, it } from "vitest";
import { GLOBAL_ROLES, isGlobalRole } from "./grants";
import { ROLES, ROLE_LIST } from "./role-labels";

/**
 * Story 15.A, AC3 and AC4.
 *
 * `[TAG_EXEC, TAG_CSD, ADMIN]` was written out three times: session.ts:205,
 * session.ts:296 and api-session.ts:78. Consolidating it is only safe if the
 * constant means exactly what those three spelled out, so that is asserted
 * against every role rather than against the three names — a test that just
 * re-lists the same three would agree with a typo.
 */

/** The predicate as the three call sites wrote it, before consolidation. */
function asWrittenBefore(role: string): boolean {
  return role === ROLES.TAG_EXEC || role === ROLES.TAG_CSD || role === ROLES.ADMIN;
}

describe("GLOBAL_ROLES", () => {
  it("matches the old inline triple for every role in the system", () => {
    for (const role of ROLE_LIST) {
      expect(isGlobalRole(role), `${role} disagrees with the pre-consolidation check`)
        .toBe(asWrittenBefore(role));
    }
  });

  it("is exactly the three roles that reach every location", () => {
    expect([...GLOBAL_ROLES].sort()).toEqual(
      [ROLES.ADMIN, ROLES.TAG_CSD, ROLES.TAG_EXEC].sort(),
    );
  });

  it("does not treat tag_csm as global, which is the near-miss", () => {
    // tag_csm sits next to tag_csd in every list and is scoped to its own book.
    expect(isGlobalRole(ROLES.TAG_CSM)).toBe(false);
  });

  it("rejects an unknown string rather than throwing", () => {
    expect(isGlobalRole('not_a_role')).toBe(false);
  });
});
