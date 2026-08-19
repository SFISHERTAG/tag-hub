import { InjectionToken, Signal } from '@angular/core';
import type { Role } from '../models/role.model';
import type { Session } from '../models/session.model';

/**
 * Contract for wherever session/role data comes from. Components and
 * PermissionService depend on this interface only, never a concrete class —
 * swapping MockRbacService for a real HTTP-backed implementation later is a
 * one-line provider change in app.config.ts, zero component changes.
 */
export interface RbacService {
  /** Current session, or null if signed out. */
  readonly session: Signal<Session | null>;
  /** Switches the active hat to one of the user's availableRoles. */
  switchRole(role: Role): void;
}

export const RBAC_SERVICE = new InjectionToken<RbacService>('RBAC_SERVICE');
