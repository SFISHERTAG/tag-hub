import type { Role } from '../../../core/models/role.model';

/**
 * Wire shapes for `/api/admin/users*`, mirrored from lib/auth/user-directory.ts,
 * lib/auth/groups.ts and lib/dashboard/csm-directory.ts so a change on either
 * side of the boundary is a compile error here rather than an undefined at
 * runtime.
 *
 * Nothing in this file is a security boundary. Every endpoint behind it
 * re-checks `ROLES.ADMIN` server-side; a client that invents a role value gets
 * a 400, and one that omits a field gets a 403 before the field is read.
 */
export interface DirectoryUser {
  readonly uid: string;
  readonly email: string | null;
  readonly role: Role | null;
  readonly locations: readonly string[];
  readonly groupId: string | null;
  readonly groupName: string | null;
}

export interface Group {
  readonly id: string;
  readonly name: string;
  readonly role: Role;
  /** Empty means no restriction beyond whatever the role itself implies. */
  readonly locations: readonly string[];
  readonly memberUids: readonly string[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

export type CsmRole = 'csm' | 'csd' | 'exec';

/** CS reporting line, keyed by email — the collection `csm/{email}`. */
export interface CsmRecord {
  readonly email: string;
  readonly role: CsmRole;
  readonly managerEmail: string | null;
}

/** Everything `GET /api/admin/users` returns, in one round trip. */
export interface AdminUsersDirectory {
  readonly users: readonly DirectoryUser[];
  readonly groups: readonly Group[];
  readonly csmRecords: readonly CsmRecord[];
}

/**
 * Location lists travel as the raw text an admin typed, never as a
 * client-split array.
 *
 * The endpoint accepts both (`locations` or `locationsRaw`) and the split rule
 * lives server-side in app/api/admin/users/_locations.ts. Sending the raw text
 * keeps exactly one implementation of "what separates two ids" — a second
 * caller (a script, a curl) would otherwise have to guess, and the two would
 * drift the first time someone pasted a newline-separated list.
 */
export interface NewGroupInput {
  readonly name: string;
  readonly role: Role;
  readonly locationsRaw: string;
}

export interface GroupRoleInput {
  readonly role: Role;
  readonly locationsRaw: string;
}

export interface IndividualRoleInput {
  readonly role: Role;
  readonly locationsRaw: string;
  /** From the directory record, not typed by the admin. */
  readonly email: string | null;
  /** CS reporting line. Only tag_csm / tag_csd participate; null otherwise. */
  readonly managerEmail: string | null;
}

export interface CreatedGroup {
  readonly group: Group;
}

export interface Acknowledged {
  readonly ok: true;
}
