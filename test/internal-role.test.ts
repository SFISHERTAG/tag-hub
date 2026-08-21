import { describe, expect, it } from "vitest";
import { isInternalRole } from "@/lib/auth/session";
import { ROLES, ROLE_LIST } from "@/lib/auth/roles";
import { isClientUser } from "@/lib/dashboard/location-selection";

/**
 * isInternalRole gates the staff path through authorizeOnboardingTrigger
 * (lib/api/webhook-auth.ts) — a session it approves may start a client's
 * provisioning pipeline with no secret at all. Every case here is a way it
 * could say yes when it should say no.
 */
describe("isInternalRole", () => {
  it("admits every TAG-side role", () => {
    for (const role of [
      ROLES.ADMIN, ROLES.TAG_EXEC, ROLES.TAG_CSD, ROLES.TAG_CSM,
      ROLES.TAG_SALES_MANAGER, ROLES.TAG_SALES, ROLES.TAG_SETTER_MANAGER, ROLES.TAG_SETTER,
    ]) {
      expect(isInternalRole(role)).toBe(true);
    }
  });

  it("refuses every client role", () => {
    for (const role of ROLE_LIST.filter((r) => r.startsWith("client_"))) {
      expect(isInternalRole(role)).toBe(false);
    }
  });

  it("covers all of ROLES with no role left unclassified", () => {
    const unclassified = ROLE_LIST.filter(
      (r) => !isInternalRole(r) && !r.startsWith("client_"),
    );
    expect(unclassified).toEqual([]);
  });

  it("is NOT the inverse of isClientUser — the trap this exists to avoid", () => {
    // isClientUser names only three of the five client roles, so !isClientUser
    // would report client_setter and client_setter_manager as internal.
    const wouldBeWrong = ROLE_LIST.filter(
      (r) => r.startsWith("client_") && !isClientUser(r),
    );
    expect(wouldBeWrong.length).toBeGreaterThan(0); // the gap is real
    for (const role of wouldBeWrong) {
      expect(isInternalRole(role)).toBe(false); // and we do not fall into it
    }
  });

  it("refuses an unknown role rather than defaulting to internal", () => {
    expect(isInternalRole("something_new" as never)).toBe(false);
  });
});
