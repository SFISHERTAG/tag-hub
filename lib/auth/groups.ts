import "server-only";
import { firestore } from "@/lib/firestore";
import { setUserClaims } from "./admin";
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

const GROUPS_COLLECTION = "groups";

function fromDoc(id: string, data: FirebaseFirestore.DocumentData): Group {
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
  const snapshot = await firestore().collection(GROUPS_COLLECTION).get();
  return snapshot.docs
    .map((d) => fromDoc(d.id, d.data()))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getGroup(id: string): Promise<Group | null> {
  const doc = await firestore().collection(GROUPS_COLLECTION).doc(id).get();
  return doc.exists ? fromDoc(doc.id, doc.data()!) : null;
}

/**
 * The group a user currently belongs to, if any. An `array-contains` query
 * rather than a denormalised field on the user — Firebase custom claims are
 * capped at 1000 bytes total, already spent on role and locations, so
 * "which group" has to live on the group side and be searched for.
 */
export async function findMemberGroup(uid: string): Promise<Group | null> {
  const snapshot = await firestore()
    .collection(GROUPS_COLLECTION)
    .where("memberUids", "array-contains", uid)
    .limit(1)
    .get();
  return snapshot.empty ? null : fromDoc(snapshot.docs[0].id, snapshot.docs[0].data());
}

/** Removes a user from whatever group currently lists them, if any. Firestore-only — does not touch their claims. */
async function detachFromCurrentGroup(uid: string): Promise<void> {
  const current = await findMemberGroup(uid);
  if (!current) return;
  await firestore()
    .collection(GROUPS_COLLECTION)
    .doc(current.id)
    .update({
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
  const ref = firestore().collection(GROUPS_COLLECTION).doc();
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
  const group = await getGroup(id);
  if (!group) throw new Error(`Group ${id} not found.`);

  await firestore()
    .collection(GROUPS_COLLECTION)
    .doc(id)
    .update({ role, locations, updatedAt: Date.now() });

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
  await firestore().collection(GROUPS_COLLECTION).doc(id).delete();
}

export async function addMemberToGroup(groupId: string, uid: string): Promise<void> {
  const group = await getGroup(groupId);
  if (!group) throw new Error(`Group ${groupId} not found.`);

  await detachFromCurrentGroup(uid);
  await firestore()
    .collection(GROUPS_COLLECTION)
    .doc(groupId)
    .update({
      memberUids: [...new Set([...group.memberUids, uid])],
      updatedAt: Date.now(),
    });
  await setUserClaims(uid, [{ role: group.role, locations: group.locations }]);
}

/** Removes membership only. See the comment on `deleteGroup` for why claims are left alone. */
export async function removeMemberFromGroup(groupId: string, uid: string): Promise<void> {
  const group = await getGroup(groupId);
  if (!group) return;
  await firestore()
    .collection(GROUPS_COLLECTION)
    .doc(groupId)
    .update({
      memberUids: group.memberUids.filter((id) => id !== uid),
      updatedAt: Date.now(),
    });
}

/** Individual assignment is "no group" — detaches first so group and individual state can't both claim this user. */
export async function assignIndividualRole(
  uid: string,
  role: Role,
  locations: string[],
): Promise<void> {
  validateLocations(locations);
  await detachFromCurrentGroup(uid);
  await setUserClaims(uid, [{ role, locations }]);
}
