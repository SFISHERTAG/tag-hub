import { Injectable, signal } from '@angular/core';
import type { Role } from '../models/role.model';
import type { Session } from '../models/session.model';
import type { RbacService } from './rbac.service';

/**
 * Hardcoded session, standing in for the real auth/session API until it
 * exists. Provided via the RBAC_SERVICE token in app.config.ts — every
 * consumer depends on that token, so removing this class later is a
 * one-line provider swap.
 */
const MOCK_SESSION: Session = {
  uid: 'mock-uid',
  email: 'dev@example.com',
  currentRole: 'tag_exec',
  availableRoles: ['tag_exec', 'tag_csm', 'tag_csd', 'admin'],
  locations: ['mock-location-1'],
};

@Injectable()
export class MockRbacService implements RbacService {
  private readonly _session = signal<Session | null>(MOCK_SESSION);
  readonly session = this._session.asReadonly();

  switchRole(role: Role): void {
    const current = this._session();
    if (!current || !current.availableRoles.includes(role)) return;
    this._session.set({ ...current, currentRole: role });
  }
}
