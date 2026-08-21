import { describe, expect, it } from "vitest";
import { resolveScope } from "@/lib/dashboard/scope";
import type { Session } from "@/lib/auth/session";
import type { Role } from "@/lib/auth/roles";

/**
 * resolveScope decides whose rows a dashboard shows. Every case here is a way
 * it could fail *open* — the direction that leaks one person's numbers to
 * another — so each asserts the narrow outcome, not merely a defined one.
 */

function session(overrides: Partial<Session> & { currentRole: Role }): Session {
  return {
    uid: "user-a",
    email: "a@test",
    availableRoles: [overrides.currentRole],
    locations: ["loc-a"],
    ...overrides,
  };
}

describe("resolveScope", () => {
  it("gives a closer only their own rows", () => {
    const scope = resolveScope(session({ currentRole: "client_closer" }));
    expect(scope.level).toBe("self");
    expect(scope.uids).toEqual(["user-a"]);
  });

  it("gives an owner the whole tenancy", () => {
    const scope = resolveScope(session({ currentRole: "client_owner" }));
    expect(scope.level).toBe("tenancy");
    expect(scope.uids).toBe("all");
  });

  it("includes the manager themselves in their team", () => {
    const scope = resolveScope(
      session({ currentRole: "client_manager", scope: "team", team: ["user-b", "user-c"] }),
    );
    expect(scope.level).toBe("team");
    expect(scope.uids).toEqual(expect.arrayContaining(["user-a", "user-b", "user-c"]));
  });

  it("narrows a team grant naming nobody to self, never to everyone", () => {
    const scope = resolveScope(
      session({ currentRole: "client_manager", scope: "team", team: [] }),
    );
    expect(scope.level).toBe("self");
    expect(scope.uids).toEqual(["user-a"]);
  });

  it("narrows to self when the grant's scope value is unrecognised", () => {
    const scope = resolveScope(
      session({ currentRole: "client_closer", scope: "everything" as never }),
    );
    expect(scope.level).toBe("self");
    expect(scope.uids).toEqual(["user-a"]);
  });

  it("lets an explicit grant narrow a role that defaults wider", () => {
    const scope = resolveScope(session({ currentRole: "client_owner", scope: "self" }));
    expect(scope.level).toBe("self");
    expect(scope.uids).toEqual(["user-a"]);
  });

  it("does not widen locations beyond the session's own", () => {
    const scope = resolveScope(session({ currentRole: "client_owner" }));
    expect(scope.locations).toEqual(["loc-a"]);
  });

  it("deduplicates a team that already names the manager", () => {
    const scope = resolveScope(
      session({ currentRole: "client_manager", scope: "team", team: ["user-a", "user-b"] }),
    );
    expect(scope.uids).toEqual(["user-a", "user-b"]);
  });
});
