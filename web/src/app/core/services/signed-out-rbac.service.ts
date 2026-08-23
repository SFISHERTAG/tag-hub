import { Injectable, signal } from '@angular/core';
import type { Session } from '../models/session.model';
import type { ApiResult } from '../models/api-result.model';
import type { RbacService } from './rbac.service';

/**
 * Reports "signed out", always.
 *
 * Retained as the fail-closed fallback for any configuration where no real
 * session source is wired: every guard then denies and redirects to sign-in,
 * which is the correct posture for an app that cannot resolve a session.
 *
 * Not currently provided anywhere — HttpRbacService took its place in
 * app.config.ts once the session endpoint existed. Kept because "no session
 * source" is a state worth having a safe answer for, and because deleting it
 * would leave the alternative as an unprovided token, which turns a missing
 * session into an injector crash at first render.
 */
@Injectable()
export class SignedOutRbacService implements RbacService {
  readonly session = signal<Session | null>(null).asReadonly();

  load(): Promise<void> {
    return Promise.resolve();
  }

  switchRole(): Promise<ApiResult<Session>> {
    return Promise.resolve({
      data: null,
      error: { message: 'Not signed in.', context: 'SignedOutRbacService', status: 401 },
    });
  }

  /** Already signed out; nothing to end. */
  async signOut(): Promise<void> {
    return;
  }

  applySession(): void {
    // Nothing to apply: this implementation is signed out by definition.
  }
}
