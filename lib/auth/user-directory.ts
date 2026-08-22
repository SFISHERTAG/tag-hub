import "server-only";
import { adminAuth } from "./admin";
import type { Role } from "./roles";
import type { ScopeLevel } from "./grants";
import { parseRoleGrants } from "./session";
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
      // Through parseRoleGrants, the same reader the session uses — the
      // screen that WRITES grants must agree with the session that enforces
      // them about what a claim says. This also reads the legacy single-role
      // shape (scripts/create-user.mjs wrote it until 2026-08-22), which the
      // old hand-copied parsing here could not: those users showed "no role"
      // in the directory while holding a fully working session.
      const grants = parseRoleGrants(claims);
      const primary = grants[0];
      const role: Role | null = primary?.role ?? null;
      const locations = primary?.locations ?? [];
      const scope: ScopeLevel | null = primary?.scope ?? null;
      const team = primary?.scope === "team" ? (primary.team ?? []) : [];
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
