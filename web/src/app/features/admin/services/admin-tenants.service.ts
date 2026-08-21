import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import type { ApiResult } from '../../../core/models/api-result.model';
import type { SavedTenant, TenantDetail, TenantList, TenantSettings } from './admin-tenants.model';

const TENANTS_URL = '/api/admin/tenants';

/**
 * Typed access to tenant administration.
 *
 * `save` sends the Meta ids as strings including `""`, never omitting them.
 * Firestore is configured with `ignoreUndefinedProperties`, which makes an
 * absent field a no-op under `merge: true` — so a dropped empty string would
 * silently leave the previous value in place and an admin clearing a pixel id
 * would watch the old one come back on reload.
 */
@Injectable({ providedIn: 'root' })
export class AdminTenantsService {
  private readonly api = inject(ApiService);

  list(): Promise<ApiResult<TenantList>> {
    return firstValueFrom(this.api.get<TenantList>(TENANTS_URL));
  }

  get(locationId: string): Promise<ApiResult<TenantDetail>> {
    return firstValueFrom(
      this.api.get<TenantDetail>(`${TENANTS_URL}/${encodeURIComponent(locationId)}`),
    );
  }

  save(locationId: string, settings: TenantSettings): Promise<ApiResult<SavedTenant>> {
    return firstValueFrom(
      this.api.put<SavedTenant>(`${TENANTS_URL}/${encodeURIComponent(locationId)}`, {
        services: settings.services,
        ownerModel: settings.ownerModel,
        metaAdAccountId: settings.metaAdAccountId,
        metaBusinessId: settings.metaBusinessId,
        metaPixelId: settings.metaPixelId,
      }),
    );
  }
}
