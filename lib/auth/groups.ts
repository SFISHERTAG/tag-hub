import "server-only";
import { repository } from "@/lib/data";
import { setUserClaims } from "./admin";
import {
  assertWithinClaimLimit,
  normaliseGrants,
  type ScopeLevel,
} from "./grants";
import { isValidLocationId } from "@/lib/ghl/tenants";
import type { Role } from "./roles";

/**
 * Named groups of users that share a role.
 *
 * A group is a management convenience, not a second authorization path. The
 * thing `session.ts` actually reads is the Firebase custom claim on each
 * user — verified once, at sign-in, and baked into the session cookie — so a
 * group's job is to *write* those claims onto every member, not to be
 * checked live on every request. That keeps the security-critical path
 * exactly as simple as it already was: one claim, one verification, no new
 * runtime dependency on Firestore being reachable to answer "is this
 * request allowed".
 *
 * A user belongs to at most one group. Assigning someone to a new group
 * silently drops them from whatever group they were in before — mirroring
 * `role` itself being a single value, not a set, this keeps "which group is
 * this person in" answerable by looking in one place rather than reconciling
 * several.
 */
export type Group = {
  id: string;
  name: string;
  role: Role;
  /** Empty means no restriction beyond whatever the role itself implies. */
  locations: string[];
  memberUids: string[];
  createdAt: number;
  updatedAt: number;
};

const groups = () => repository().groups;

function fromDoc(id: string, data: Omit<Group, "id">): Group {
  return {
    id,
    name: typeof data.name === "string" ? data.name : id,
    role: data.role as Role,
    locations: Array.isArray(data.locations) ? data.locations : [],
    memberUids: Array.isArray(data.memberUids) ? data.memberUids : [],
    createdAt: data.createdAt ?? 0,
    updatedAt: data.updatedAt ?? 0,
  };
}

export async function listGroups(): Promise<Group[]> {
  const found = await groups().list();
  return found
    .map(({ id, data }) => fromDoc(id, data))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getGroup(id: string): Promise<Group | null> {
  const data = await groups().doc(id).get();
  return data ? fromDoc(id, data) : null;
}

/**
 * The group a user currently belongs to, if any. An `array-contains` query
 * rather than a denormalised field on the user — Firebase custom claims are
 * capped at 1000 bytes total, already spent on role and locations, so
 * "which group" has to live on the group side and be searched for.
 */
export async function findMemberGroup(uid: string): Promise<Group | null> {
  const [found] = await groups().list({
    where: [{ field: "memberUids", op: "array-contains", value: uid }],
    limit: 1,
  });
  return found ? fromDoc(found.id, found.data) : null;
}

/** Removes a user from whatever group currently lists them, if any. Firestore-only — does not touch their claims. */
async function detachFromCurrentGroup(uid: string): Promise<void> {
  const current = await findMemberGroup(uid);
  if (!current) return;
  await groups().doc(current.id).update({
    memberUids: current.memberUids.filter((id) => id !== uid),
    updatedAt: Date.now(),
  });
}

export class InvalidLocationError extends Error {
  constructor(readonly locationId: string) {
    super(`"${locationId}" is not a valid GHL location id.`);
    this.name = "InvalidLocationError";
  }
}

function validateLocations(locations: string[]): void {
  for (const id of locations) {
    if (!isValidLocationId(id)) throw new InvalidLocationError(id);
  }
}

export async function createGroup(
  name: string,
  role: Role,
  locations: string[],
): Promise<Group> {
  validateLocations(locations);
  const now = Date.now();
  const ref = groups().doc(groups().newId());
  await ref.set({ name, role, locations, memberUids: [], createdAt: now, updatedAt: now });
  return { id: ref.id, name, role, locations, memberUids: [], createdAt: now, updatedAt: now };
}

/**
 * Changes what a group grants and immediately re-applies it to every current
 * member. A group that did not do this would be live in name only — its
 * members' actual access would silently lag behind whatever the group says
 * it grants, and "the group's role" and "what its members can do" would be
 * two facts that can disagree.
 */
export async function updateGroupRole(
  id: string,
  role: Role,
  locations: string[],
): Promise<void> {
  validateLocations(locations);
  // The grant is identical for every member, so its validity is decided once,
  // here — before the group doc changes and before any member's claims do.
  // Letting each per-member setUserClaims discover the same problem meant a
  // grant that was invalid for everyone could partially write: the Promise.all
  // fired all members concurrently and some landed before a sibling rejected.
  // (The subject uid does not matter for a teamless grant; validation ignores it.)
  assertWithinClaimLimit({ roles: normaliseGrants("", [{ role, locations }]) });

  const group = await getGroup(id);
  if (!group) throw new Error(`Group ${id} not found.`);

  await groups().doc(id).update({ role, locations, updatedAt: Date.now() });

  await Promise.all(
    group.memberUids.map((uid) => setUserClaims(uid, [{ role, locations }])),
  );
}

/**
 * Deletes the group record. Members keep whatever claims they were last
 * given — deleting the group is a bookkeeping action, not a bulk revoke, for
 * the same reason `removeMember` below doesn't reset claims either: an admin
 * clearing a list is not the same intent as an admin revoking access, and
 * conflating them means the safer-looking action is also the more
 * dangerous one.
 */
export async function deleteGroup(id: string): Promise<void> {
  await groups().doc(id).delete();
}

export async function addMemberToGroup(groupId: string, uid: string): Promise<void> {
  const group = await getGroup(groupId);
  if (!group) throw new Error(`Group ${groupId} not found.`);

  await detachFromCurrentGroup(uid);
  await groups().doc(groupId).update({
    memberUids: [...new Set([...group.memberUids, uid])],
    updatedAt: Date.now(),
  });
  await setUserClaims(uid, [{ role: group.role, locations: group.locations }]);
}

/** Removes membership only. See the comment on `deleteGroup` for why claims are left alone. */
export async function removeMemberFromGroup(groupId: string, uid: string): Promise<void> {
  const group = await getGroup(groupId);
  if (!group) return;
  await groups().doc(groupId).update({
    memberUids: group.memberUids.filter((id) => id !== uid),
    updatedAt: Date.now(),
  });
}

/**
 * Individual assignment is "no group" — detaches first so group and individual
 * state can't both claim this user.
 *
 * `scope` and `team` are optional and omitted by default, so a caller that does
 * not pass them writes exactly the grant this function always wrote and the
 * role default still applies (Story 7.7, AC2). Group assignment deliberately
 * does not take them: a group's members share a role, not a team, and giving
 * every member the same team list is a different feature.
 */
export async function assignIndividualRole(
  uid: string,
  role: Role,
  locations: string[],
  scope?: ScopeLevel,
  team?: string[],
): Promise<void> {
  validateLocations(locations);
  // Validate BEFORE the detach. setUserClaims re-runs this, but by then the
  // group write has happened: the 2026-08-22 review found a rejected grant
  // ("nothing was written") that had already removed the user from their
  // group, leaving them with the group's old claims and none of its updates.
  // The validation is pure, so running it here costs nothing and makes the
  // error message's promise true.
  assertWithinClaimLimit({ roles: normaliseGrants(uid, [{ role, locations, scope, team }]) });

  await detachFromCurrentGroup(uid);
  await setUserClaims(uid, [{ role, locations, scope, team }]);
}
