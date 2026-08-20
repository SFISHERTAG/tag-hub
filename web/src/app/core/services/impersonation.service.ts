import { Injectable, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../http/api.service';
import { RBAC_SERVICE } from './rbac.service';
import type { Session } from '../models/session.model';
import type { ApiResult } from '../models/api-result.model';

const ENTER_URL = '/api/impersonation/enter';
const EXIT_URL = '/api/impersonation/exit';

/**
 * Entering and leaving a client tenant.
 *
 * State is read off the session rather than held here, because the server
 * returns the whole session from both endpoints and the hub_impersonation
 * cookie is httpOnly. A separate copy would be a second source of truth that
 * disagrees after any reload.
 *
 * Nothing here is a security control. The server writes the audit entry before
 * granting access and re-checks the grant on every request; this is the UI half.
 */
@Injectable({ providedIn: 'root' })
export class ImpersonationService {
  private readonly api = inject(ApiService);
  private readonly rbac = inject(RBAC_SERVICE);

  /** The tenant currently being impersonated, or null. */
  readonly current = computed(() => this.rbac.session()?.impersonation ?? null);

  readonly isImpersonating = computed(() => this.current() !== null);

  async enter(locationId: string): Promise<ApiResult<Session>> {
    return this.applyOnSuccess(
      await firstValueFrom(this.api.post<Session>(ENTER_URL, { locationId })),
    );
  }

  async exit(): Promise<ApiResult<Session>> {
    return this.applyOnSuccess(await firstValueFrom(this.api.post<Session>(EXIT_URL, {})));
  }

  /**
   * Both endpoints return the full session, so applying it is what makes the
   * banner and every guard agree with the cookie that was just written. Leaving
   * the session stale here is how a banner outlives the access it describes.
   */
  private applyOnSuccess(result: ApiResult<Session>): ApiResult<Session> {
    if (!result.error) this.rbac.applySession(result.data);
    return result;
  }
}
