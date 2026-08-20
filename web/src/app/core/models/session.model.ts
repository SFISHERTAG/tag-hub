import type { Role } from './role.model';

/**
 * Active impersonation, as reported by the server.
 *
 * Only the location id. The audit entry id and actor id are server-side
 * correlation values with no client use, and echoing the actor back would
 * confirm to a caller holding a forged cookie whose session it was minted
 * against.
 */
export interface ImpersonationState {
  locationId: string;
}

/**
 * Port of the SessionPayload in lib/auth/session-payload.ts. Keep the two in
 * sync.
 *
 * This is replaced wholesale from a server response, never merged field by
 * field. `locations` is derived from `currentRole` on the server, and for the
 * wide hats it is the result of a lookup, so there is no client-side expression
 * that produces it. Patching one field would silently desynchronise tenant
 * access from the displayed hat.
 */
export interface Session {
  uid: string;
  email: string | null;
  currentRole: Role;
  availableRoles: Role[];
  locations: string[];
  /**
   * Present on every session response rather than fetched separately: the
   * hub_impersonation cookie is httpOnly, so without this the banner would
   * disappear on reload while the access it describes stayed live.
   */
  impersonation: ImpersonationState | null;
}
