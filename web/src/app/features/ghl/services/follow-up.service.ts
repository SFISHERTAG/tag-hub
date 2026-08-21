import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import type { ApiResult } from '../../../core/models/api-result.model';
import { locationBase } from './ghl-endpoints';
import type { FollowUpConfig, FollowUpConfigResponse, FollowUpResponse } from './ghl.model';

export const FOLLOW_UP_MAX_LIMIT = 100;
export const FOLLOW_UP_DEFAULT_LIMIT = 50;
/** The largest threshold the endpoint will store. Ten years of days, or ten
 * years of daily attempts — a ceiling, not a product rule. */
export const FOLLOW_UP_MAX_THRESHOLD = 3650;

/**
 * One queue, two screens.
 *
 * The today panel asks with `enrich=false` (Story 2.8 AC5: no per-row fetch)
 * and the dedicated screen asks with `enrich=true`. Both hit the same endpoint,
 * which runs the same `resolveFollowUpQueue` — the shared rule that excludes
 * CANCELLED appointments when deciding whether a contact rebooked. A cancelled
 * booking is not a rebooking; it is the opposite, and treating it as one
 * silently drops exactly the lead the queue exists to surface. Two screens
 * computing membership separately is how they came to disagree about the same
 * contact in the first place, so neither computes it here.
 */
@Injectable({ providedIn: 'root' })
export class FollowUpService {
  private readonly api = inject(ApiService);

  queue(
    locationId: string,
    options: { enrich?: boolean; limit?: number } = {},
  ): Promise<ApiResult<FollowUpResponse>> {
    return firstValueFrom(
      this.api.get<FollowUpResponse>(`${locationBase(locationId)}/follow-up`, {
        enrich: options.enrich === true ? 1 : 0,
        limit: options.limit ?? FOLLOW_UP_DEFAULT_LIMIT,
      }),
    );
  }

  config(locationId: string): Promise<ApiResult<FollowUpConfigResponse>> {
    return firstValueFrom(
      this.api.get<FollowUpConfigResponse>(`${locationBase(locationId)}/follow-up/config`),
    );
  }

  /**
   * The response's `canConfigure` is a hint for hiding a control, never the
   * check. This PUT is refused server-side for any hat outside the closing
   * manager / owner pair regardless of what the UI showed.
   */
  saveConfig(
    locationId: string,
    config: FollowUpConfig,
  ): Promise<ApiResult<FollowUpConfigResponse>> {
    return firstValueFrom(
      this.api.put<FollowUpConfigResponse>(
        `${locationBase(locationId)}/follow-up/config`,
        config,
      ),
    );
  }
}
