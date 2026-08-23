import { Injectable, signal } from '@angular/core';
import { ROLES, type Role } from '../models/role.model';
import type { Session } from '../models/session.model';
import type { ApiResult } from '../models/api-result.model';
import { ok } from '../models/api-result.model';
import type { RbacService } from './rbac.service';

/**
 * Hardcoded session for development only.
 *
 * Provided behind isDevMode() in app.config.ts. It was once provided
 * unconditionally, which meant a production bundle carried this tag_exec
 * session — availableRoles including admin — and both route guards passed for
 * everyone with no server involved at all.
 *
 * Kept so `ng serve` works without a running Next API. Delete it when that stops
 * being useful; every consumer depends on RBAC_SERVICE, not this class.
 */
const MOCK_SESSION: Session = {
  uid: 'mock-uid',
  email: 'dev@example.com',
  currentRole: ROLES.TAG_EXEC,
  availableRoles: [ROLES.TAG_EXEC, ROLES.TAG_CSM, ROLES.TAG_CSD, ROLES.ADMIN],
  locations: ['mock-location-1'],
  impersonation: null,
};

@Injectable()
export class MockRbacService implements RbacService {
  private readonly _session = signal<Session | null>(MOCK_SESSION);
  readonly session = this._session.asReadonly();

  load(): Promise<void> {
    // Already resolved. Async to match the interface, since the real
    // implementation is a round trip.
    return Promise.resolve();
  }

  switchRole(role: Role): Promise<ApiResult<Session>> {
    const current = this._session();
    if (!current || !current.availableRoles.includes(role)) {
      return Promise.resolve({
        data: null,
        error: { message: 'You do not have access to that role.', context: 'MockRbacService', status: 403 },
      });
    }

    // Deliberately does NOT recompute locations. The real endpoint re-derives
    // them from the hat's own grant; nothing here can, which is exactly why the
    // switch is a server round trip in production.
    const next: Session = { ...current, currentRole: role };
    this._session.set(next);
    return Promise.resolve(ok(next));
  }

  /** Clears the mock session, same as the real one does on success. */
  async signOut(): Promise<void> {
    this.applySession(null);
  }

  applySession(session: Session | null): void {
    this._session.set(session);
  }
}
