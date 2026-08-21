import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import type { ApiResult } from '../../../core/models/api-result.model';
import type {
  ClientListWidgetResponse,
  DepartmentOverviewResponse,
  TeamHealthRollupResponse,
} from './client.model';

const WIDGETS_URL = '/api/dashboard/widgets';

/**
 * The four dashboard widgets whose data is the client book.
 *
 * Separate from ClientsService because these are separate endpoints with a
 * separate gate: each one calls `requireWidget(session, id)` server-side, which
 * checks the widget's own `availableFor` list before it touches any data. A
 * role that lost access to `team_health_rollup` gets a 403 here even though its
 * saved dashboard layout still names the widget. That is the point — the saved
 * layout is what drives the fetch, so entitlement has to be checked at the
 * fetch and not only at the picker.
 *
 * None of these take a scope. The book each one returns is derived from the
 * session's role: a CSM's assignments, a CSD's team, an exec's department.
 */
@Injectable({ providedIn: 'root' })
export class ClientWidgetsService {
  private readonly api = inject(ApiService);

  /** Every client in the caller's book. Backs the `portfolio` widget. */
  getPortfolio(): Promise<ApiResult<ClientListWidgetResponse>> {
    return firstValueFrom(this.api.get<ClientListWidgetResponse>(`${WIDGETS_URL}/portfolio`));
  }

  /** Same client set as the portfolio, framed by health. Backs `client_health`. */
  getClientHealth(): Promise<ApiResult<ClientListWidgetResponse>> {
    return firstValueFrom(this.api.get<ClientListWidgetResponse>(`${WIDGETS_URL}/client-health`));
  }

  /** CSD-only server-side. Team is keyed on `session.email`, never sent. */
  getTeamHealthRollup(): Promise<ApiResult<TeamHealthRollupResponse>> {
    return firstValueFrom(
      this.api.get<TeamHealthRollupResponse>(`${WIDGETS_URL}/team-health-rollup`),
    );
  }

  /** Exec-only server-side. */
  getDepartmentOverview(): Promise<ApiResult<DepartmentOverviewResponse>> {
    return firstValueFrom(
      this.api.get<DepartmentOverviewResponse>(`${WIDGETS_URL}/department-overview`),
    );
  }
}
