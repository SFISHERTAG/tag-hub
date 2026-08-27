import { describe, expect, it } from "vitest";
import {
  CLAIMS_BYTE_LIMIT,
  GrantValidationError,
  SCOPE_LEVELS,
  assertTeamUidsExist,
  assertWithinClaimLimit,
  normaliseGrants,
} from "@/lib/auth/grants";
import { ROLES } from "@/lib/auth/roles";
import { parseRoleGrants } from "@/lib/auth/session";
import { resolveScope } from "@/lib/dashboard/scope";
import type { Session } from "@/lib/auth/session";
import { vi } from "vitest";

/**
 * Story 7.7. `resolveScope` has read `scope` and `team` since 7.6 and nothing
 * has ever written them, so every claim ever issued carries neither and the
 * per-hat scope has always been the role default. This is the write side.
 *
 * The tests are mostly refusals, because every one of them is a way of storing
 * something the read path would later act on. A team behind a `self` grant, a
 * scope value session.ts will silently drop, a uid nobody can resolve: each
 * looks harmless at the write and decides what somebody sees at the read.
 */

const SUBJECT = "uid-subject";

function grant(over: Partial<Parameters<typeof normaliseGrants>[1][number]> = {}) {
  return { role: ROLES.TAG_SALES_MANAGER, locations: ["loc-a"], ...over };
}

describe("scope validation", () => {
  it("accepts each level session.ts parses", () => {
    for (const level of SCOPE_LEVELS) {
      const [out] = normaliseGrants(SUBJECT, [
        grant({ scope: level, team: level === "team" ? ["uid-b"] : undefined }),
      ]);
      expect(out.scope).toBe(level);
    }
  });

  it("refuses a level session.ts would drop, rather than storing it", () => {
    expect(() =>
      normaliseGrants(SUBJECT, [grant({ scope: "everyone" as never })]),
    ).toThrow(GrantValidationError);
  });

  it("leaves a grant with no scope alone, so the role default still applies", () => {
    const [out] = normaliseGrants(SUBJECT, [grant()]);
    expect(out.scope).toBeUndefined();
    expect(out.team).toBeUndefined();
  });
});

describe("team belongs only to a team scope", () => {
  it("refuses a team on a self grant", () => {
    expect(() =>
      normaliseGrants(SUBJECT, [grant({ scope: "self", team: ["uid-b"] })]),
    ).toThrow(GrantValidationError);
  });

  it("refuses a team on a tenancy grant", () => {
    expect(() =>
      normaliseGrants(SUBJECT, [grant({ scope: "tenancy", team: ["uid-b"] })]),
    ).toThrow(GrantValidationError);
  });

  it("refuses a team on a grant with no scope at all", () => {
    expect(() => normaliseGrants(SUBJECT, [grant({ team: ["uid-b"] })])).toThrow(
      GrantValidationError,
    );
  });

  it("refuses a team scope with nobody in it", () => {
    // resolveScope narrows an empty team to self. Storing one means writing a
    // grant that reads as a demotion, so it is refused at the write instead.
    expect(() => normaliseGrants(SUBJECT, [grant({ scope: "team", team: [] })])).toThrow(
      GrantValidationError,
    );
  });
});

describe("team membership hygiene", () => {
  it("drops the subject from their own team", () => {
    const [out] = normaliseGrants(SUBJECT, [
      grant({ scope: "team", team: [SUBJECT, "uid-b"] }),
    ]);
    expect(out.team).toEqual(["uid-b"]);
  });

  it("collapses duplicates", () => {
    const [out] = normaliseGrants(SUBJECT, [
      grant({ scope: "team", team: ["uid-b", "uid-b", "uid-c"] }),
    ]);
    expect(out.team).toEqual(["uid-b", "uid-c"]);
  });

  it("refuses a team that is only the subject, since dropping them empties it", () => {
    expect(() =>
      normaliseGrants(SUBJECT, [grant({ scope: "team", team: [SUBJECT] })]),
    ).toThrow(GrantValidationError);
  });
});

describe("claim size ceiling", () => {
  it("accepts a claim inside the limit", () => {
    expect(() => assertWithinClaimLimit({ roles: [grant()] })).not.toThrow();
  });

  it("refuses one past it", () => {
    const huge = { roles: [grant({ scope: "team", team: Array.from({ length: 200 }, (_, i) => `uid-${i}`) })] };
    expect(() => assertWithinClaimLimit(huge)).toThrow(GrantValidationError);
  });

  it("names the limit, so the failure does not read as a role problem", () => {
    const huge = { roles: [grant({ scope: "team", team: Array.from({ length: 200 }, (_, i) => `uid-${i}`) })] };
    expect(() => assertWithinClaimLimit(huge)).toThrow(new RegExp(String(CLAIMS_BYTE_LIMIT)));
  });
});

describe("team members must resolve to real users", () => {
  // The resolver reports which of the asked-about uids do NOT exist, in one
  // batch. It must only answer that question — a transient failure is not an
  // answer, and the old per-uid try/catch turned an Auth outage into "these
  // users do not exist".
  const missingOf = vi.fn(async (uids: readonly string[]) =>
    uids.filter((uid) => !["uid-b", "uid-c"].includes(uid)),
  );

  it("passes when every member resolves", async () => {
    const grants = normaliseGrants(SUBJECT, [grant({ scope: "team", team: ["uid-b", "uid-c"] })]);
    await expect(assertTeamUidsExist(grants, missingOf)).resolves.toBeUndefined();
  });

  it("asks in one batch, not one call per member", async () => {
    missingOf.mockClear();
    const grants = normaliseGrants(SUBJECT, [grant({ scope: "team", team: ["uid-b", "uid-c"] })]);
    await assertTeamUidsExist(grants, missingOf);
    expect(missingOf).toHaveBeenCalledTimes(1);
    expect([...missingOf.mock.calls[0][0]].sort()).toEqual(["uid-b", "uid-c"]);
  });

  it("fails the whole write when one member does not resolve", async () => {
    const grants = normaliseGrants(SUBJECT, [grant({ scope: "team", team: ["uid-b", "uid-ghost"] })]);
    await expect(assertTeamUidsExist(grants, missingOf)).rejects.toBeInstanceOf(
      GrantValidationError,
    );
  });

  it("names the uid that could not be resolved", async () => {
    const grants = normaliseGrants(SUBJECT, [grant({ scope: "team", team: ["uid-ghost"] })]);
    await expect(assertTeamUidsExist(grants, missingOf)).rejects.toThrow(/uid-ghost/);
  });

  it("lets a transient resolver failure through as itself, never as 'user missing'", async () => {
    const outage = new Error("ECONNRESET talking to Firebase");
    const failing = vi.fn(async () => {
      throw outage;
    });
    const grants = normaliseGrants(SUBJECT, [grant({ scope: "team", team: ["uid-b"] })]);
    await expect(assertTeamUidsExist(grants, failing)).rejects.toBe(outage);
  });

  it("checks nothing on grants that carry no team", async () => {
    const checked = vi.fn(async () => []);
    await assertTeamUidsExist(normaliseGrants(SUBJECT, [grant({ scope: "tenancy" })]), checked);
    expect(checked).not.toHaveBeenCalled();
  });
});

/**
 * The point of the story in one describe: what the write path stores, the read
 * path must accept. These two files validate scope independently, and a level
 * accepted by one and dropped by the other is a grant that reads as set and
 * behaves as unset — invisible from the admin screen that wrote it.
 */
describe("what is written survives being read", () => {
  it("round-trips every scope level through parseRoleGrants", () => {
    for (const level of SCOPE_LEVELS) {
      const written = normaliseGrants(SUBJECT, [
        grant({ scope: level, team: level === "team" ? ["uid-b"] : undefined }),
      ]);
      const [read] = parseRoleGrants({ roles: written });
      expect(read.scope, `${level} did not survive the round trip`).toBe(level);
    }
  });

  it("round-trips a team", () => {
    const written = normaliseGrants(SUBJECT, [
      grant({ scope: "team", team: ["uid-b", "uid-c"] }),
    ]);
    const [read] = parseRoleGrants({ roles: written });
    expect(read.team).toEqual(["uid-b", "uid-c"]);
  });

  it("gives a manager their team once the grant carries one", () => {
    const [written] = normaliseGrants(SUBJECT, [
      grant({ scope: "team", team: ["uid-b", "uid-c"] }),
    ]);
    const session: Session = {
      uid: SUBJECT,
      email: "m@test",
      currentRole: ROLES.TAG_SALES_MANAGER,
      availableRoles: [ROLES.TAG_SALES_MANAGER],
      locations: ["loc-a"],
      scope: written.scope,
      team: written.team,
      grants: [written],
    };
    const scope = resolveScope(session);
    expect(scope.level).toBe("team");
    expect([...scope.uids].sort()).toEqual([SUBJECT, "uid-b", "uid-c"].sort());
  });

  it("still falls back to the role default when the grant carries no scope", () => {
    const [written] = normaliseGrants(SUBJECT, [grant()]);
    const session: Session = {
      uid: SUBJECT,
      email: "m@test",
      currentRole: ROLES.TAG_SALES_MANAGER,
      availableRoles: [ROLES.TAG_SALES_MANAGER],
      locations: ["loc-a"],
      scope: written.scope,
      team: written.team,
      grants: [written],
    };
    // DEFAULT_SCOPE_BY_ROLE says "team" for a sales manager, and an empty team
    // narrows to self. Unchanged by this story, and asserted so it stays that way.
    expect(resolveScope(session).level).toBe("self");
  });
});

describe("legacy single-role claims still resolve", () => {
  // user-directory.ts now reads claims through parseRoleGrants, so this branch
  // is what keeps pre-migration users visible in the admin screen — not just
  // signed in.
  it("parses the old { role, locations } shape into a grant", () => {
    const [grant] = parseRoleGrants({ role: ROLES.TAG_CSM, locations: ["loc-a"] });
    expect(grant).toEqual({ role: ROLES.TAG_CSM, locations: ["loc-a"] });
  });
});
