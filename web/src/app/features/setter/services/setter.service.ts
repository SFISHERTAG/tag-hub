import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import type { ApiResult } from '../../../core/models/api-result.model';
import type { SetterDashboardData } from './setter.model';

const DASHBOARD_URL = '/api/setter/dashboard';

/**
 * Typed access to the speed-to-lead board.
 *
 * One method for both the first load and every poll, because they are the same
 * request. Two paths would be two chances for the refresh to disagree with what
 * the page was seeded with — which is a way to make a frozen board look live.
 *
 * There is no `setterEmail` parameter. The endpoint reads the setter from the
 * session; an email in the query string would let any caller pull any setter's
 * queue. `locationId` is optional and, when sent, is re-checked against the
 * session server-side — it selects among the caller's own locations, it does
 * not grant one.
 */
@Injectable({ providedIn: 'root' })
export class SetterService {
  private readonly api = inject(ApiService);

  load(locationId?: string): Promise<ApiResult<SetterDashboardData>> {
    return firstValueFrom(
      this.api.get<SetterDashboardData>(
        DASHBOARD_URL,
        locationId ? { locationId } : undefined,
      ),
    );
  }
}
