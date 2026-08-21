import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import type { ApiResult } from '../../../core/models/api-result.model';
import { locationBase, opportunityPath } from './ghl-endpoints';
import type {
  CloseOpportunityRequest,
  CloseOpportunityResponse,
  MoveStageRequest,
  MoveStageResponse,
  PipelineResponse,
  PipelineStatusFilter,
} from './ghl.model';

/**
 * The pipeline board's endpoints. The board talks to this; nothing in the
 * feature touches HttpClient, per CLAUDE.md.
 *
 * Thin by design. There is no client-side grouping, no staleness rule and no
 * total: `groupByStage` and `daysSince` already exist server-side and the
 * endpoint applies them, so a second implementation here would be a second
 * opinion about which column a deal is in. The one thing this layer adds is the
 * ApiResult contract — nothing throws, and a failure arrives as a value the
 * caller has to look at rather than an exception it can flatten to an empty
 * board.
 */
@Injectable({ providedIn: 'root' })
export class PipelineService {
  private readonly api = inject(ApiService);

  board(locationId: string, status: PipelineStatusFilter): Promise<ApiResult<PipelineResponse>> {
    return firstValueFrom(
      this.api.get<PipelineResponse>(`${locationBase(locationId)}/pipeline`, { status }),
    );
  }

  /**
   * `previousStageName` is not cosmetic: leaving a Fulfillment stage closes
   * that stage's onboarding tasks server-side (Story 5.1 AC4), and the name is
   * how the endpoint tells a Fulfillment move from a Sales one. Omitting it
   * silently skips the task completion, so the board sends it whenever it knows
   * the stage it is leaving.
   */
  moveStage(
    locationId: string,
    opportunityId: string,
    body: MoveStageRequest,
  ): Promise<ApiResult<MoveStageResponse>> {
    return firstValueFrom(
      this.api.put<MoveStageResponse>(opportunityPath(locationId, opportunityId, 'stage'), body),
    );
  }

  close(
    locationId: string,
    opportunityId: string,
    body: CloseOpportunityRequest,
  ): Promise<ApiResult<CloseOpportunityResponse>> {
    return firstValueFrom(
      this.api.put<CloseOpportunityResponse>(
        opportunityPath(locationId, opportunityId, 'close'),
        body,
      ),
    );
  }
}
