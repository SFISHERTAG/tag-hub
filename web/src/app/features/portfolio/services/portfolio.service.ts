import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import type { ApiResult } from '../../../core/models/api-result.model';
import type { Portfolio } from './portfolio.model';

/** The endpoint takes no parameters. The caller's grant is the query. */
const TENANTS_URL = '/api/portfolio/tenants';

/**
 * Typed access to the portfolio endpoint. The screen talks to this; nothing in
 * the feature touches HttpClient, per CLAUDE.md.
 *
 * Thin on purpose. There is no local filtering, no caching and no merging with
 * a second source, because every one of those would put a second opinion about
 * which tenants this user may see in front of the session-derived answer.
 *
 * Entering a tenant is deliberately NOT here: that is `ImpersonationService` in
 * core/, already written, already applying the returned session so the banner
 * and the guards agree with the cookie. A second copy of that call in this
 * feature would be a second place for the session to go stale.
 */
@Injectable({ providedIn: 'root' })
export class PortfolioService {
  private readonly api = inject(ApiService);

  /**
   * Resolves with `{ data: null, error }` on failure rather than throwing —
   * the ApiResult contract. A caller has to look at `error`, which is what
   * stops a failed load being flattened into an empty client list.
   */
  listTenants(): Promise<ApiResult<Portfolio>> {
    return firstValueFrom(this.api.get<Portfolio>(TENANTS_URL));
  }
}
