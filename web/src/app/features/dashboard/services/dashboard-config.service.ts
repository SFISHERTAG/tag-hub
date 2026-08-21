import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import type { ApiResult } from '../../../core/models/api-result.model';
import type { DashboardConfig } from '../../../shared/widgets/widget.model';
import type { DashboardConfigResponse, DashboardConfigSaveResponse } from './dashboard.model';

const CONFIG_URL = '/api/dashboard/config';

/**
 * Typed access to the dashboard layout.
 *
 * One GET for the whole shell — layout, picker options, location, freshness —
 * because they are one page load, and one PUT to save.
 *
 * What this service deliberately does not do is filter the widget list. The
 * picker is UI convenience, not the entitlement boundary: the server checks
 * `availableFor` on save (403), again on read (strips and reports), and a third
 * time at each widget's own data endpoint. Filtering here as well would add a
 * fourth copy of the rule in the one layer that cannot enforce it.
 */
@Injectable({ providedIn: 'root' })
export class DashboardConfigService {
  private readonly api = inject(ApiService);

  /**
   * @param pageId The tab to open, from `?page=`. Omitted or unknown falls back
   * to the saved current page server-side, so a stale bookmark degrades instead
   * of erroring.
   */
  load(pageId?: string | null): Promise<ApiResult<DashboardConfigResponse>> {
    return firstValueFrom(
      this.api.get<DashboardConfigResponse>(
        CONFIG_URL,
        pageId ? { page: pageId } : undefined,
      ),
    );
  }

  /**
   * Saves a layout.
   *
   * `updatedAt` in the body is ignored — the server stamps its own. The role in
   * the body must match the hat currently being worn or the save is refused
   * with a 403, which is what stops one hat rewriting another's dashboard.
   */
  save(config: DashboardConfig): Promise<ApiResult<DashboardConfigSaveResponse>> {
    return firstValueFrom(this.api.put<DashboardConfigSaveResponse>(CONFIG_URL, config));
  }
}
