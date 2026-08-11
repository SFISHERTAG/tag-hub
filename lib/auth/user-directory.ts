import "server-only";
import { adminAuth } from "./admin";
import { isRole, type Role } from "./roles";
import { listGroups } from "./groups";

export type DirectoryUser = {
  uid: string;
  email: string | null;
  role: Role | null;
  locations: string[];
  groupId: string | null;
  groupName: string | null;
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
      const role = isRole(claims.role) ? claims.role : null;
      const group = groupByUid.get(record.uid);
      users.push({
        uid: record.uid,
        email: record.email ?? null,
        role,
        locations: Array.isArray(claims.locations) ? claims.locations : [],
        groupId: group?.id ?? null,
        groupName: group?.name ?? null,
      });
    }
    pageToken = page.pageToken;
  } while (pageToken);

  return users.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
}
