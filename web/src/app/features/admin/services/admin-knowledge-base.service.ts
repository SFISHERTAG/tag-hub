import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import type { ApiResult } from '../../../core/models/api-result.model';
import type {
  Acknowledged,
  ManualPageDetail,
  ManualPageDraft,
  ManualPageHistory,
  ManualPageList,
} from './admin-knowledge-base.model';

const KB_URL = '/api/admin/knowledge-base';

const seg = (value: string): string => encodeURIComponent(value);

/**
 * Typed access to knowledge-base authoring.
 *
 * No actor is ever sent. The endpoint records the version's author from the
 * session, which is what keeps "who changed this" answerable rather than
 * self-reported — a field the client fills in is a field the client can lie
 * about, and version history is exactly where that matters.
 */
@Injectable({ providedIn: 'root' })
export class AdminKnowledgeBaseService {
  private readonly api = inject(ApiService);

  list(): Promise<ApiResult<ManualPageList>> {
    return firstValueFrom(this.api.get<ManualPageList>(KB_URL));
  }

  get(pageId: string): Promise<ApiResult<ManualPageDetail>> {
    return firstValueFrom(this.api.get<ManualPageDetail>(`${KB_URL}/${seg(pageId)}`));
  }

  /** The write records the page's *current* content as a version first. */
  save(pageId: string, draft: ManualPageDraft): Promise<ApiResult<Acknowledged>> {
    return firstValueFrom(this.api.put<Acknowledged>(`${KB_URL}/${seg(pageId)}`, draft));
  }

  history(pageId: string): Promise<ApiResult<ManualPageHistory>> {
    return firstValueFrom(this.api.get<ManualPageHistory>(`${KB_URL}/${seg(pageId)}/versions`));
  }

  revert(pageId: string, versionId: string): Promise<ApiResult<Acknowledged>> {
    return firstValueFrom(
      this.api.post<Acknowledged>(
        `${KB_URL}/${seg(pageId)}/versions/${seg(versionId)}/revert`,
        null,
      ),
    );
  }
}
