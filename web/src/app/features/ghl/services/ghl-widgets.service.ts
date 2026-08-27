import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import type { ApiResult } from '../../../core/models/api-result.model';
import type { LeadsFunnelResponse } from './ghl-widgets.model';

const WIDGETS_URL = '/api/dashboard/widgets';

/**
 * The dashboard widgets whose data is GHL.
 *
 * Separate from `TodayService` / `PipelineService` and their siblings because
 * these are different endpoints with a different gate. The `/api/ghl/locations/
 * :locationId/**` routes take the location from the URL and check it against
 * the session on every request; these take no location at all — the server
 * derives it with `resolveDashboardLocation(session)` — and each one calls
 * `requireWidget(session, id)`, which re-checks the widget's own `availableFor`
 * list before touching data.
 *
 * That second gate is the one that matters here. A saved dashboard layout is
 * what drives the fetch, so a role that has lost access to a widget still has
 * the widget's id in its stored layout and will still request it. Entitlement
 * therefore has to be checked at the fetch, not only at the picker.
 *
 * Returns `ApiResult` and never throws, per `ApiService`. Note that an
 * `ApiResult` with `error: null` does NOT mean the data is good: the funnel
 * endpoint answers 200 with `funnel.ok === false` when GHL itself failed. That
 * is the payload's business and the widget unpacks it; see
 * `FunnelCountsResult`.
 */
@Injectable({ providedIn: 'root' })
export class GhlWidgetsService {
  private readonly api = inject(ApiService);

  /**
   * Leads -> booked -> showed -> closed over the last `days` days.
   *
   * `days` is sent only when the caller sets it. The server's default is 30 and
   * it validates the range (integer, 1..365), so a widget that wants the
   * default omits the parameter rather than restating 30 here — one fewer copy
   * of a number that would drift the moment the server's default changed.
   */
  getLeadsFunnel(days?: number): Promise<ApiResult<LeadsFunnelResponse>> {
    return firstValueFrom(
      this.api.get<LeadsFunnelResponse>(
        `${WIDGETS_URL}/leads-funnel`,
        days === undefined ? undefined : { days },
      ),
    );
  }
}
