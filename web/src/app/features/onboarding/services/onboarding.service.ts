import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import type { ApiResult } from '../../../core/models/api-result.model';
import type {
  ActivatedCampaign,
  CampaignFormInput,
  CampaignPreview,
  CampaignTemplateList,
  Checklist,
  CreatedCampaign,
  TaskSaved,
  TaskToggle,
} from './onboarding.model';

const CHECKLIST_URL = '/api/onboarding/checklist';
const TASK_URL = `${CHECKLIST_URL}/task`;
const TEMPLATES_URL = '/api/onboarding/campaign-templates';
const LAUNCH_URL = '/api/onboarding/campaign-launch';

/**
 * Typed access to onboarding and campaign launch.
 *
 * Three things about the launch half are deliberate and should stay that way.
 *
 * **`preview` validates and creates nothing.** Budget and daily-cap rules live
 * in `parseCampaignFormInputs` server-side, shared by the preview, the create
 * and the review screen. Re-expressing them as Angular validators would give
 * two implementations of "what is a legal budget", and the client's copy would
 * be the one that drifts. It touches Meta not at all, so it is safe to call on
 * every change.
 *
 * **`create` produces a PAUSED campaign.** Nothing spends.
 *
 * **`activate` is a separate call and demands `confirmSpend: true`.** That flag
 * is not ceremony. It is what makes it impossible for real ad spend to start as
 * a side effect of a create, a retry, or a double-submit — Story 5.5's
 * activation had zero call sites because the only button in the flow submitted
 * the create, and merging the two would have fixed that by making the opposite
 * mistake.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly api = inject(ApiService);

  /** `locationId` is optional: omitted, the server falls back to the entered client. */
  checklist(locationId?: string): Promise<ApiResult<Checklist>> {
    return firstValueFrom(
      this.api.get<Checklist>(CHECKLIST_URL, locationId ? { locationId } : undefined),
    );
  }

  setTask(toggle: TaskToggle): Promise<ApiResult<TaskSaved>> {
    return firstValueFrom(this.api.post<TaskSaved>(TASK_URL, toggle));
  }

  templates(): Promise<ApiResult<CampaignTemplateList>> {
    return firstValueFrom(this.api.get<CampaignTemplateList>(TEMPLATES_URL));
  }

  /** Validation only. No side effects, in this app or in Meta. */
  preview(input: CampaignFormInput): Promise<ApiResult<CampaignPreview>> {
    return firstValueFrom(this.api.post<CampaignPreview>(`${LAUNCH_URL}/preview`, input));
  }

  /** Creates the campaign paused. Idempotent on identical inputs. */
  create(
    input: CampaignFormInput,
    locationId?: string,
  ): Promise<ApiResult<CreatedCampaign>> {
    return firstValueFrom(
      this.api.post<CreatedCampaign>(LAUNCH_URL, { ...input, locationId }),
    );
  }

  /**
   * Unpauses the campaign in Meta and advances the Fulfillment stage.
   * THIS STARTS REAL AD SPEND.
   *
   * `confirmSpend` is a required literal `true` rather than a parameter, so a
   * caller cannot pass a variable that happens to be truthy. Without it the
   * endpoint answers 400 carrying the activation warning.
   */
  activate(campaignId: string, locationId?: string): Promise<ApiResult<ActivatedCampaign>> {
    return firstValueFrom(
      this.api.post<ActivatedCampaign>(`${LAUNCH_URL}/activate`, {
        campaignId,
        confirmSpend: true,
        locationId,
      }),
    );
  }
}
