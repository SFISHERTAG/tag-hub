import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import type { ApiResult } from '../../../core/models/api-result.model';
import type {
  FlowScriptSuggestion,
  FullFramework,
  NewSuggestion,
  SuggestionAction,
} from './flow.model';

const FLOW_URL = '/api/flow';

const seg = (value: string): string => encodeURIComponent(value);

/**
 * Typed access to the FLOW framework and its suggestion queue.
 *
 * `orgId` is caller-supplied on every one of these calls, and that is safe only
 * because the endpoints re-check it: `requireLocationAccess(orgId)` runs before
 * any read, and the suggestion endpoint additionally verifies that the card
 * belongs to the org the caller named — without that second check, a caller
 * could pair their own valid org id with another tenant's card id and plant a
 * suggestion on a tenancy they were never checked against.
 *
 * Resolving *which* org, though, is a gap this client cannot close: see the
 * note on FlowFramework.
 */
@Injectable({ providedIn: 'root' })
export class FlowService {
  private readonly api = inject(ApiService);

  framework(orgId: string): Promise<ApiResult<FullFramework>> {
    return firstValueFrom(
      this.api.get<FullFramework>(`${FLOW_URL}/org/${seg(orgId)}/framework`),
    );
  }

  /** The review queue. Reviewer roles only, re-checked server-side. */
  pendingSuggestions(orgId: string): Promise<ApiResult<readonly FlowScriptSuggestion[]>> {
    return firstValueFrom(
      this.api.get<readonly FlowScriptSuggestion[]>(
        `${FLOW_URL}/org/${seg(orgId)}/suggestions`,
        { status: 'pending' },
      ),
    );
  }

  /**
   * Proposes an edit. Never changes what other closers see — approval is a
   * separate act by someone with review access.
   */
  suggest(suggestion: NewSuggestion): Promise<ApiResult<FlowScriptSuggestion>> {
    return firstValueFrom(
      this.api.post<FlowScriptSuggestion>(
        `${FLOW_URL}/card/${seg(suggestion.cardId)}/suggestions`,
        {
          org_id: suggestion.orgId,
          suggested_content: suggestion.content,
          suggestion_note: suggestion.note || undefined,
        },
      ),
    );
  }

  /** Approving writes a new script version and an audit entry. Rejecting changes nothing. */
  resolve(
    suggestionId: string,
    action: SuggestionAction,
  ): Promise<ApiResult<FlowScriptSuggestion>> {
    return firstValueFrom(
      this.api.post<FlowScriptSuggestion>(
        `${FLOW_URL}/suggestions/${seg(suggestionId)}/resolve`,
        { action },
      ),
    );
  }
}
