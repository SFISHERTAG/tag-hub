import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import type { ApiResult } from '../../../core/models/api-result.model';
import type { ManualPageDetail, ManualPageList } from './manual.model';

const KB_URL = '/api/knowledge-base';

/**
 * Read-only access to the operating manual.
 *
 * There is no write method here on purpose. Editing lives behind
 * /api/admin/knowledge-base and belongs to the admin feature; a save method on
 * this service would be an affordance for a screen whose viewers are gated to
 * read, and the endpoint would refuse it anyway.
 *
 * The gate is `isInternalRole` server-side — the same allowlist the legacy page
 * spelled out as TAG_STAFF_ROLES, now kept in one place so a role added later
 * is not silently treated as internal.
 */
@Injectable({ providedIn: 'root' })
export class KnowledgeBaseService {
  private readonly api = inject(ApiService);

  list(): Promise<ApiResult<ManualPageList>> {
    return firstValueFrom(this.api.get<ManualPageList>(KB_URL));
  }

  get(pageId: string): Promise<ApiResult<ManualPageDetail>> {
    return firstValueFrom(
      this.api.get<ManualPageDetail>(`${KB_URL}/${encodeURIComponent(pageId)}`),
    );
  }
}
