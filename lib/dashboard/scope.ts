import type { Role } from "@/lib/auth/roles";
import type { Session } from "@/lib/auth/session";

/**
 * Data scope — the third axis of "what may I see on my dashboard".
 *
 * Role decides which widgets are offered. The `locations` grant decides which
 * tenancy. Neither says *whose rows*: inside one tenancy a closer and a closing
 * manager are indistinguishable, and that is the gap this closes.
 *
 * The failure this is designed against is a metric fetcher that forgets to
 * filter and quietly shows one person another person's numbers. It fails
 * silently, reviews clean, and gets found by a user rather than a test. So the
 * unscoped call is made *unrepresentable* rather than merely discouraged:
 * `ScopeFilter` carries a unique-symbol brand, no object literal satisfies it,
 * and `resolveScope` is the only thing that can mint one. A fetcher that skips
 * scoping does not typecheck.
 *
 * See docs/ROLE_SCOPE_MODEL.md.
 */

export type ScopeLevel = "self" | "team" | "tenancy";

declare const scopeBrand: unique symbol;

/**
 * The filter every metric fetcher takes instead of a bare `locationId`.
 *
 * `uids: "all"` means every user in the granted locations — tenancy scope. A
 * uid array means exactly those users, and is never empty: `resolveScope`
 * narrows an empty team to the caller's own uid rather than to "nobody", since
 * an empty IN-list is the kind of thing a query silently turns into "no rows"
 * or, worse, gets optimised away entirely.
 */
export type ScopeFilter = {
  readonly level: ScopeLevel;
  readonly locations: readonly string[];
  readonly uids: readonly string[] | "all";
  readonly [scopeBrand]: "scope";
};

/**
 * Scope for a grant that does not carry one.
 *
 * Every claim issued before the `scope` field existed lands here, so this map
 * is the compatibility layer, not a default worth arguing about in the
 * abstract. Oversight roles get the whole tenancy because that is what their
 * dashboards already showed; individual-contributor roles get their own rows.
 * Anything unrecognised falls through to `self` in `resolveScope`.
 */
const DEFAULT_SCOPE_BY_ROLE: Partial<Record<Role, ScopeLevel>> = {
  admin: "tenancy",
  tag_exec: "tenancy",
  tag_csd: "tenancy",
  tag_csm: "tenancy",
  tag_sales_manager: "team",
  tag_setter_manager: "team",
  tag_sales: "self",
  tag_setter: "self",
  client_owner: "tenancy",
  client_manager: "team",
  client_setter_manager: "team",
  client_closer: "self",
  client_setter: "self",
};

function isScopeLevel(value: unknown): value is ScopeLevel {
  return value === "self" || value === "team" || value === "tenancy";
}

/** The only way to obtain a `ScopeFilter`. */
function mint(
  level: ScopeLevel,
  locations: readonly string[],
  uids: readonly string[] | "all",
): ScopeFilter {
  return { level, locations, uids } as ScopeFilter;
}

/**
 * Resolves what the current session may see, for the hat it is currently wearing.
 *
 * Fails closed in every direction: an unknown role, an unreadable scope value,
 * or a team grant with nobody in it all narrow to the caller's own rows. The
 * widest interpretation is never the fallback — `getTenant` takes the same
 * position on a missing document (lib/ghl/tenants.ts), one level up.
 */
export function resolveScope(session: Session): ScopeFilter {
  const locations = session.locations;

  const declared = isScopeLevel(session.scope) ? session.scope : undefined;
  const level: ScopeLevel =
    declared ?? DEFAULT_SCOPE_BY_ROLE[session.currentRole] ?? "self";

  if (level === "tenancy") {
    return mint("tenancy", locations, "all");
  }

  if (level === "team") {
    // A team grant naming nobody is a misconfiguration, not permission to see
    // everyone. Narrow to self and let it look wrong to the one person it
    // affects, rather than leaking the team to them.
    const team = (session.team ?? []).filter((uid) => typeof uid === "string" && uid.length > 0);
    const uids = team.length > 0 ? Array.from(new Set([...team, session.uid])) : [session.uid];
    return mint(team.length > 0 ? "team" : "self", locations, uids);
  }

  return mint("self", locations, [session.uid]);
}

/**
 * Test-only constructor.
 *
 * Registry-driven scope tests need to build filters directly, and the brand
 * exists precisely to stop that happening in application code. Keeping the
 * escape hatch here, named unmistakably, is better than exporting `mint` or
 * having tests cast — both of which read as legitimate at a call site.
 */
export function unsafeScopeForTests(
  level: ScopeLevel,
  locations: readonly string[],
  uids: readonly string[] | "all",
): ScopeFilter {
  return mint(level, locations, uids);
}
