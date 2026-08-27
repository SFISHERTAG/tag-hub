import { ROLES, type Role } from "./roles";

/**
 * The write side of Story 7.6's per-hat scope.
 *
 * `resolveScope` has read `RoleGrant.scope` and `.team` since 7.6 and
 * `session.ts` has parsed them defensively, but `setUserClaims` only ever wrote
 * `{ role, locations }`. So both fields were undefined on every claim ever
 * issued and the scope always fell through to `DEFAULT_SCOPE_BY_ROLE`. This
 * module is what makes a grant able to say whose rows it sees.
 *
 * Pure on purpose. Everything here is validation and normalisation over plain
 * objects, so it is provable without Firebase; the one part that needs I/O,
 * confirming a team uid resolves to a real user, stays in `setUserClaims`.
 *
 * The rule the whole file follows: refuse at the write what the read path would
 * silently drop. `parseRoleGrants` discards an unrecognised scope rather than
 * passing it through, which is right for a claim already in the wild and wrong
 * as a way to accept one. A value dropped at read time is a grant that looks
 * set to whoever wrote it and behaves as though it never was.
 */

export type ScopeLevel = "self" | "team" | "tenancy";

/**
 * The levels `parseRoleGrants` accepts, in one place so the two cannot drift.
 * A level added here without being added there is a scope that writes cleanly
 * and reads as undefined.
 */
export const SCOPE_LEVELS = ["self", "team", "tenancy"] as const;

/**
 * Firebase rejects a custom claims object over 1000 bytes.
 *
 * Checked here rather than left to the SDK because the SDK's error arrives as a
 * generic claims failure on a request the admin thinks is about roles. AC7 is
 * about the message: "this team is too large" and "your role change failed" are
 * different problems and only one of them is true.
 */
/**
 * The roles whose reach is every location, regardless of what their grant says.
 *
 * Story 15.A. This was written out inline three times — session.ts:205,
 * session.ts:296 and api-session.ts:78 — byte-identical, and three places to
 * forget when a fourth global role appears.
 *
 * It belongs here rather than in role-labels.ts because it is the constant that
 * makes ROLES_AND_GRANTS_PLAN.md §4 enforceable: "global reach comes from the
 * role, not the claim". Any design expressing the wildcard as `locations: []`
 * turns an ordinary admin typo — a blank locations textarea, which
 * app/api/admin/users/_locations.ts returns as `[]` — into "reaches every
 * tenant". Because reach is decided here, `locations: []` can keep meaning no
 * locations, and that empty textarea keeps failing closed.
 */
export const GLOBAL_ROLES: readonly Role[] = [ROLES.TAG_EXEC, ROLES.TAG_CSD, ROLES.ADMIN];

/** True when the role reaches every location. Takes a string so callers need not narrow first. */
export function isGlobalRole(role: string): boolean {
  return (GLOBAL_ROLES as readonly string[]).includes(role);
}

export const CLAIMS_BYTE_LIMIT = 1000;

export class GrantValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GrantValidationError";
  }
}

export type GrantInput = {
  role: Role;
  locations: string[];
  scope?: ScopeLevel;
  team?: string[];
};

/** A grant as it is written into the claim. */
export type GrantClaim = {
  role: Role;
  locations: string[];
  scope?: ScopeLevel;
  team?: string[];
};

function isScopeLevel(value: unknown): value is ScopeLevel {
  return (SCOPE_LEVELS as readonly unknown[]).includes(value);
}

/**
 * Validates and normalises grants for one subject.
 *
 * `subjectUid` is whose claim this is, and it is needed because a team must not
 * contain its own owner: `resolveScope` already adds the caller to the uid list
 * it builds, so storing them again is a duplicate that costs claim bytes and
 * means nothing.
 */
export function normaliseGrants(
  subjectUid: string,
  grants: readonly GrantInput[],
): GrantClaim[] {
  return grants.map((grant) => {
    if (grant.scope !== undefined && !isScopeLevel(grant.scope)) {
      throw new GrantValidationError(
        `Unknown scope "${String(grant.scope)}" on the ${grant.role} grant. ` +
          `Expected one of: ${SCOPE_LEVELS.join(", ")}.`,
      );
    }

    if (grant.team !== undefined && grant.scope !== "team") {
      throw new GrantValidationError(
        `A team was given on the ${grant.role} grant, whose scope is ` +
          `${grant.scope ?? "unset"}. Only a "team" scope reads its team, so this ` +
          `would store members nothing acts on.`,
      );
    }

    if (grant.scope !== "team") {
      return { role: grant.role, locations: grant.locations, scope: grant.scope };
    }

    const members = Array.from(new Set(grant.team ?? [])).filter((uid) => uid !== subjectUid);

    // resolveScope narrows an empty team to "self" on purpose, treating it as a
    // misconfiguration rather than permission to see everyone. Writing one is
    // therefore writing a grant that reads as a demotion, and the person who
    // set it would have no way to tell from the admin screen.
    if (members.length === 0) {
      throw new GrantValidationError(
        `The ${grant.role} grant has a "team" scope with nobody in it. ` +
          `An empty team resolves to the caller's own rows, so this would read ` +
          `as a demotion rather than a team grant.`,
      );
    }

    return { role: grant.role, locations: grant.locations, scope: "team", team: members };
  });
}

/** Refuses a claims object Firebase would reject, with a message that says why. */
export function assertWithinClaimLimit(claims: object): void {
  const bytes = Buffer.byteLength(JSON.stringify(claims), "utf8");
  if (bytes > CLAIMS_BYTE_LIMIT) {
    throw new GrantValidationError(
      `These grants serialise to ${bytes} bytes and Firebase caps custom claims at ` +
        `${CLAIMS_BYTE_LIMIT}. This is a size problem, not a role problem: shrink the ` +
        `team, or move it behind a group id rather than storing the uids inline. ` +
        `Do not truncate it; a silently shortened team is a silently narrowed dashboard.`,
    );
  }
}

/**
 * Confirms every team member is a real user, before any of them is stored.
 *
 * `missingOf` answers one question in one batch: of these uids, which do NOT
 * resolve to a user? It must answer only that — a transient failure is not an
 * answer, so the resolver propagates its own errors rather than mapping them
 * to "missing". The first version of this took a per-uid exists() callback
 * whose bare catch did exactly that mapping, and an Auth outage read as
 * "these team members do not resolve to a user", naming real people.
 *
 * All-or-nothing on purpose. Writing the members that resolved and dropping
 * the rest would silently narrow a manager's team to whoever happened to be
 * spelled correctly, and neither the admin who typed it nor the manager who
 * lives with it would see anything wrong. The same reasoning as Story 7.8's
 * refusal to answer a partially resolved team.
 */
export async function assertTeamUidsExist(
  grants: readonly GrantClaim[],
  missingOf: (uids: readonly string[]) => Promise<readonly string[]>,
): Promise<void> {
  const members = Array.from(new Set(grants.flatMap((grant) => grant.team ?? [])));
  if (members.length === 0) return;

  const missing = await missingOf(members);
  if (missing.length > 0) {
    throw new GrantValidationError(
      `These team members do not resolve to a user: ${missing.join(", ")}. ` +
        `Nothing was written; a team stored without them would silently be smaller ` +
        `than the one that was intended.`,
    );
  }
}
