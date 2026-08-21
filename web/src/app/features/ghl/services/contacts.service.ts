import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import type { ApiResult } from '../../../core/models/api-result.model';
import { contactPath, locationBase } from './ghl-endpoints';
import type {
  ContactDetailResponse,
  ContactsResponse,
  NotesResponse,
  PrepResponse,
} from './ghl.model';

/** GHL's own ceiling on the contacts endpoint, restated so the screen's request
 * cannot quietly ask for a page the server will reject with a 400. */
export const CONTACTS_MAX_LIMIT = 100;
export const CONTACTS_DEFAULT_LIMIT = 50;

@Injectable({ providedIn: 'root' })
export class ContactsService {
  private readonly api = inject(ApiService);

  /**
   * `q` is omitted entirely when blank rather than sent as an empty string. The
   * endpoint treats them the same, but an empty parameter in the URL turns a
   * shareable "all contacts" link into "?q=", which then round-trips into the
   * search box as a search nobody performed.
   */
  search(
    locationId: string,
    options: { query?: string | null; limit?: number } = {},
  ): Promise<ApiResult<ContactsResponse>> {
    const query = options.query?.trim() ?? '';
    const limit = options.limit ?? CONTACTS_DEFAULT_LIMIT;
    const params: Record<string, string | number> = { limit };
    if (query !== '') params['q'] = query;

    return firstValueFrom(
      this.api.get<ContactsResponse>(`${locationBase(locationId)}/contacts`, params),
    );
  }

  detail(locationId: string, contactId: string): Promise<ApiResult<ContactDetailResponse>> {
    return firstValueFrom(
      this.api.get<ContactDetailResponse>(contactPath(locationId, contactId)),
    );
  }

  notes(locationId: string, contactId: string): Promise<ApiResult<NotesResponse>> {
    return firstValueFrom(
      this.api.get<NotesResponse>(contactPath(locationId, contactId, '/notes')),
    );
  }

  /**
   * Returns the REFRESHED list, not an acknowledgement. The endpoint re-reads
   * after the write for exactly this reason: a caller that had to fetch again
   * would be making a second round trip to learn something the first one
   * already knew, and would render a stale list for the gap in between.
   */
  addNote(locationId: string, contactId: string, body: string): Promise<ApiResult<NotesResponse>> {
    return firstValueFrom(
      this.api.post<NotesResponse>(contactPath(locationId, contactId, '/notes'), { body }),
    );
  }

  /**
   * Call prep for one contact. Called when the panel OPENS, never per row while
   * the day view renders (Story 2.7 AC4) — it costs three GHL calls, and a
   * day with a dozen appointments would spend three dozen of them before
   * showing anything.
   */
  prep(locationId: string, contactId: string): Promise<ApiResult<PrepResponse>> {
    return firstValueFrom(
      this.api.get<PrepResponse>(contactPath(locationId, contactId, '/prep')),
    );
  }
}
