import { InjectionToken, Signal } from '@angular/core';
import type { Role } from '../models/role.model';
import type { Session } from '../models/session.model';
import type { ApiResult } from '../models/api-result.model';

/**
 * Contract for wherever session data comes from. Components, guards and
 * PermissionService depend on this interface only, never a concrete class, so
 * swapping the implementation is a one-line provider change.
 *
 * The one rule every implementation must honour: a session is REPLACED from a
 * server response, never patched. `locations` is derived from `currentRole` on
 * the server and for the wide hats requires a lookup, so a client that mutated
 * `currentRole` alone would report tenant access the new hat does not have.
 * That is why `switchRole` is asynchronous and returns a result: it is a round
 * trip, not a local assignment.
 */
export interface RbacService {
  /** Current session, or null when signed out. */
  readonly session: Signal<Session | null>;

  /**
   * Resolves the session from the server. Called once from the app
   * initializer, before any route activates, so no guard ever observes a
   * transient null on a cold load. Resolves rather than rejects when signed
   * out: "no session" is an answer, not a failure.
   */
  load(): Promise<void>;

  /** Switches the active hat. Round-trips and replaces the whole session. */
  switchRole(role: Role): Promise<ApiResult<Session>>;

  /**
   * Ends the session and clears it.
   *
   * Here rather than on the auth feature's service because `layout/` needs it
   * and must not know which features exist — the boundary in
   * web/eslint.config.js, and CLAUDE.md's architecture isolation rule. Signing
   * out is a session operation, and this is the session authority, so it is not
   * a workaround for the boundary; it is the right home.
   *
   * Rejects on failure rather than resolving quietly. The endpoint sits behind
   * the CSRF origin guard, and a swallowed 403 leaves someone believing they
   * signed out when they did not.
   */
  signOut(): Promise<void>;

  /**
   * Replaces the session from a payload another service already fetched, so a
   * sign-in or an impersonation change does not need a second round trip to be
   * reflected. Pass null to clear.
   */
  applySession(session: Session | null): void;
}

export const RBAC_SERVICE = new InjectionToken<RbacService>('RBAC_SERVICE');
