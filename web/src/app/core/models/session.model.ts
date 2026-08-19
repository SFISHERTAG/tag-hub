import type { Role } from './role.model';

/** Port of the Session shape in lib/auth/session.ts — keep the two in sync. */
export interface Session {
  uid: string;
  email: string | null;
  currentRole: Role;
  availableRoles: Role[];
  locations: string[];
}
