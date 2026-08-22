import { beforeEach, describe, expect, it, vi } from "vitest";
import { GrantValidationError } from "@/lib/auth/grants";
import { ROLES } from "@/lib/auth/role-labels";

/**
 * Ordering bugs from the 2026-08-22 review. assignIndividualRole detached the
 * user from their group BEFORE setUserClaims ran Story 7.7's validation, so a
 * rejected grant ("nothing was written") had already removed group
 * membership — the user kept the group's old claims but stopped receiving its
 * updates, invisibly. updateGroupRole fanned identical grants out per member
 * and let each one validate independently, so a grant that was invalid for
 * everyone could partially write before a sibling rejected.
 */

const setUserClaims = vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined);
const firestoreSpy = vi.fn<(...args: unknown[]) => void>();

vi.mock("@/lib/auth/admin", () => ({
  setUserClaims: (...args: unknown[]) => setUserClaims(...args),
}));
vi.mock("@/lib/firestore", () => ({
  firestore: (...args: unknown[]) => {
    firestoreSpy(...args);
    throw new Error("Firestore must not be touched before validation passes");
  },
}));
vi.mock("@/lib/ghl/tenants", () => ({
  isValidLocationId: () => true,
}));

const { assignIndividualRole, updateGroupRole } = await import("@/lib/auth/groups");

beforeEach(() => {
  setUserClaims.mockClear();
  firestoreSpy.mockClear();
});

describe("assignIndividualRole validates before it detaches", () => {
  it("a rejected grant leaves group membership untouched", async () => {
    await expect(
      assignIndividualRole("uid-1", ROLES.TAG_SALES_MANAGER, ["loc-a"], "self", ["uid-b"]),
    ).rejects.toBeInstanceOf(GrantValidationError);
    expect(firestoreSpy).not.toHaveBeenCalled();
    expect(setUserClaims).not.toHaveBeenCalled();
  });

  it("an empty team is refused before any write, same as the deeper layer would", async () => {
    await expect(
      assignIndividualRole("uid-1", ROLES.TAG_SALES_MANAGER, ["loc-a"], "team", []),
    ).rejects.toBeInstanceOf(GrantValidationError);
    expect(firestoreSpy).not.toHaveBeenCalled();
  });
});

describe("updateGroupRole validates once before the fan-out", () => {
  it("an invalid grant reaches zero members", async () => {
    // The group grant is identical for every member, so validity is decided
    // once. Reaching setUserClaims for ANY member before that decision is the
    // partial-write bug.
    await expect(
      updateGroupRole("grp-1", ROLES.TAG_SALES_MANAGER, "not,real,locations".split(",").length > 0
        ? (Array.from({ length: 200 }, (_, i) => `loc-${"x".repeat(40)}-${i}`) as string[])
        : []),
    ).rejects.toBeInstanceOf(GrantValidationError);
    expect(setUserClaims).not.toHaveBeenCalled();
  });
});
