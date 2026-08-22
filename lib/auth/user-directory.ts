import "server-only";
import { adminAuth } from "./admin";
import { isRole, type Role } from "./roles";
import { SCOPE_LEVELS, type ScopeLevel } from "./grants";
import { listGroups } from "./groups";

export type DirectoryUser = {
  uid: string;
  email: string | null;
  role: Role | null;
  locations: string[];
  groupId: string | null;
  groupName: string | null;
  /** Per-hat data scope on the primary grant, or null when it falls back to the role default. */
  scope: ScopeLevel | null;
  /** Team uids when `scope` is "team"; empty otherwise. */
  team: string[];
};

/** Every Firebase user, paginated to whatever this project actually has — small enough today not to need a server-side search. */
export async function listAllUsers(): Promise<DirectoryUser[]> {
  // One pass over groups rather than one Firestore query per user — the
  // membership lookup `findMemberGroup` does for a single uid is exactly
  // this same scan, so doing it once up front avoids N of them here.
  const groups = await listGroups();
  const groupByUid = new Map(groups.flatMap((g) => g.memberUids.map((uid) => [uid, g])));

  const users: DirectoryUser[] = [];
  let pageToken: string | undefined;

  do {
    const page = await adminAuth().listUsers(1000, pageToken);
    for (const record of page.users) {
      const claims = record.customClaims ?? {};
      // Claims are written as `roles: [{role, locations}]` (setUserClaims in
      // ./admin) — there is no top-level `role`/`locations` field to read.
      // Individual assignment currently writes exactly one grant, so the
      // first entry is the user's role; a future multi-grant write path
      // would need this to expose the full array instead.
      const grants = Array.isArray(claims.roles) ? claims.roles : [];
      const primary = grants.find(
        (g): g is { role: Role; locations: unknown } =>
          typeof g === "object" && g !== null && isRole((g as Record<string, unknown>).role),
      );
      const role = primary ? (primary.role as Role) : null;
      const locations = Array.isArray(primary?.locations) ? (primary.locations as string[]) : [];
      // Read back so the admin screen can show what is set and therefore offer
      // to clear it. Parsed with the same tolerance as parseRoleGrants: an
      // unrecognised value reads as "unset", which is what the session does
      // with it, so the screen and the session agree.
      const rawScope = (primary as Record<string, unknown> | undefined)?.scope;
      const scope = (SCOPE_LEVELS as readonly unknown[]).includes(rawScope)
        ? (rawScope as ScopeLevel)
        : null;
      const rawTeam = (primary as Record<string, unknown> | undefined)?.team;
      const team =
        scope === "team" && Array.isArray(rawTeam)
          ? (rawTeam as unknown[]).filter((uid): uid is string => typeof uid === "string")
          : [];
      const group = groupByUid.get(record.uid);
      users.push({
        uid: record.uid,
        email: record.email ?? null,
        role,
        locations,
        groupId: group?.id ?? null,
        groupName: group?.name ?? null,
        scope,
        team,
      });
    }
    pageToken = page.pageToken;
  } while (pageToken);

  return users.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
}
