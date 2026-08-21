import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import type { ApiResult } from '../../../core/models/api-result.model';
import type {
  ClientAlertsResponse,
  ClientBookQuery,
  ClientBookResponse,
  ClientCampaignsResponse,
  ClientCreativesResponse,
  ClientDetailResponse,
  ClientPhase3Response,
} from './client.model';

const BOOK_URL = '/api/clients';

/**
 * Typed access to `/api/clients/**`. Screens talk to this; nothing in this
 * feature touches `HttpClient`, per CLAUDE.md.
 *
 * Deliberately thin. There is no caching, no merging with a second source and
 * no client-side re-filtering of the returned set, because each of those would
 * put a second opinion about which clients this user may see in front of the
 * session-derived answer.
 *
 * Every method resolves with `ApiResult` and none of them throw. `{ data: [],
 * error: null }` means the book is empty; `{ data: null, error }` means we do
 * not know what is in it. A screen that cannot tell those apart tells a CSM
 * their book is empty during an outage — the exact failure the ApiResult
 * contract exists to prevent.
 */
@Injectable({ providedIn: 'root' })
export class ClientsService {
  private readonly api = inject(ApiService);

  /**
   * The client book.
   *
   * `scope` defaults to `mine` server-side and is keyed on `session.email`, so
   * omitting it cannot be pointed at anyone else's clients. Reading a peer's
   * book requires saying `scope: 'csm'` with an email out loud, which keeps
   * coverage legible as coverage.
   */
  listClients(query: ClientBookQuery = {}): Promise<ApiResult<ClientBookResponse>> {
    return firstValueFrom(this.api.get<ClientBookResponse>(BOOK_URL, toParams(query)));
  }

  getClient(clientId: string): Promise<ApiResult<ClientDetailResponse>> {
    return firstValueFrom(this.api.get<ClientDetailResponse>(`${BOOK_URL}/${encode(clientId)}`));
  }

  getAlerts(clientId: string): Promise<ApiResult<ClientAlertsResponse>> {
    return firstValueFrom(
      this.api.get<ClientAlertsResponse>(`${BOOK_URL}/${encode(clientId)}/alerts`),
    );
  }

  /**
   * Campaigns for a client's Meta ad account.
   *
   * `withCreativeCounts` is opt-in because it costs one extra lookup per
   * campaign server-side. When it is off, every `creative_count` is 0 and
   * `creativeCountsIncluded` is false — a screen must read the flag rather than
   * the zeroes, or "not counted" renders as "none".
   */
  getCampaigns(
    clientId: string,
    withCreativeCounts = false,
  ): Promise<ApiResult<ClientCampaignsResponse>> {
    return firstValueFrom(
      this.api.get<ClientCampaignsResponse>(
        `${BOOK_URL}/${encode(clientId)}/campaigns`,
        withCreativeCounts ? { withCreativeCounts: true } : undefined,
      ),
    );
  }

  /**
   * Creatives for a client.
   *
   * Note what is NOT a parameter: the location. The reference implementation
   * passed a `locationId` taken straight off a client-side object and reached
   * Google Drive with it unchecked — the audit's caller-supplied-id pattern.
   * The endpoint now reads it from the client's own record, so there is no id
   * here to forge and none to validate.
   */
  getCreatives(clientId: string): Promise<ApiResult<ClientCreativesResponse>> {
    return firstValueFrom(
      this.api.get<ClientCreativesResponse>(`${BOOK_URL}/${encode(clientId)}/creatives`),
    );
  }

  getPhase3(clientId: string): Promise<ApiResult<ClientPhase3Response>> {
    return firstValueFrom(
      this.api.get<ClientPhase3Response>(`${BOOK_URL}/${encode(clientId)}/phase3`),
    );
  }
}

/**
 * Only the fields the caller actually set.
 *
 * An empty string is dropped rather than sent: `?search=` and no `search` mean
 * the same thing to the endpoint, and `?status=` would be rejected as an
 * unknown status. Sending "I have not chosen" as a value is how a cleared
 * search box turns into a 400.
 */
function toParams(query: ClientBookQuery): Record<string, string> | undefined {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string' && value.length > 0) params[key] = value;
  }
  return Object.keys(params).length > 0 ? params : undefined;
}

/** A client id is a Firestore document id, but it still goes in a path segment. */
function encode(clientId: string): string {
  return encodeURIComponent(clientId);
}
