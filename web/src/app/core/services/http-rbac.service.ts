import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../http/api.service';
import type { Role } from '../models/role.model';
import type { Session } from '../models/session.model';
import type { ApiResult } from '../models/api-result.model';
import type { RbacService } from './rbac.service';

/** Kept in step with the routes in app/api/. */
const SESSION_URL = '/api/auth/session';
const ROLE_URL = '/api/session/role';
const SIGNOUT_URL = '/api/auth/signout';

/**
 * The real session source.
 *
 * Replaces MockRbacService, which returned a hardcoded tag_exec session
 * including admin in availableRoles and was provided unconditionally, so every
 * guard passed for everyone in every build.
 *
 * Note the role endpoint is /api/session/role, not /api/auth/role. proxy.ts
 * exempts the whole /api/auth prefix from its optimistic cookie gate, and the
 * authInterceptor skips its 401 refresh for any /api/auth/ URL, so a hat switch
 * on an expired cookie would hard-fail there with no refresh attempt.
 */
@Injectable()
export class HttpRbacService implements RbacService {
  private readonly api = inject(ApiService);

  private readonly _session = signal<Session | null>(null);
  readonly session = this._session.asReadonly();

  async load(): Promise<void> {
    const result = await firstValueFrom(this.api.get<Session>(SESSION_URL));

    // A 401 here is the ordinary signed-out case, not an error to propagate:
    // rejecting would fail the app initializer and the app would never boot for
    // a visitor who simply has not signed in yet. ApiService never throws, so
    // this only has to read the result.
    this._session.set(result.error ? null : result.data);
  }

  async switchRole(role: Role): Promise<ApiResult<Session>> {
    const result = await firstValueFrom(this.api.post<Session>(ROLE_URL, { role }));

    // Replace wholesale on success, and leave the existing session untouched on
    // failure. Optimistically setting the new role and rolling back on error
    // would briefly render UI for a hat the server may refuse.
    if (!result.error) this._session.set(result.data);

    return result;
  }

  /**
   * Ends the session. Clears locally only after the server accepts, so a
   * refused sign-out leaves the UI honest about still being signed in.
   */
  async signOut(): Promise<void> {
    const result = await firstValueFrom(this.api.post<{ ok: true }>(SIGNOUT_URL, {}));
    if (result.error) throw new Error(result.error.message);
    this.applySession(null);
  }

  applySession(session: Session | null): void {
    this._session.set(session);
  }
}
