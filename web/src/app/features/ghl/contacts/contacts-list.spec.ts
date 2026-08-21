import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ContactsList } from './contacts-list';
import { ContactsService } from '../services/contacts.service';
import { ok, type ApiResult } from '../../../core/models/api-result.model';
import type { ContactsResponse } from '../services/ghl.model';

/**
 * Story: the search lives in the URL, and the failure never reads as "no
 * contacts".
 *
 * Matching happens at GoHighLevel. If this screen ever filters a local array it
 * will be filtering one page of results, and the answer will be confidently
 * wrong for everyone whose contact was on page two.
 */

const search = vi.fn<() => Promise<ApiResult<ContactsResponse>>>();

function response(overrides: Partial<ContactsResponse> = {}): ContactsResponse {
  return {
    query: null,
    limit: 50,
    contacts: [
      {
        id: 'c1',
        displayName: 'Ada Lovelace',
        email: 'ada@example.com',
        phone: '+15550001111',
        companyName: 'Analytical Co',
        source: 'Meta ad',
        dateAdded: '2026-02-14T10:00:00.000Z',
      },
    ],
    truncated: false,
    ...overrides,
  };
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function setup(queryParams: Record<string, string> = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [ContactsList],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { paramMap: convertToParamMap({ locationId: 'loc1' }) },
          parent: null,
          paramMap: of(convertToParamMap({ locationId: 'loc1' })),
          queryParamMap: of(convertToParamMap(queryParams)),
        },
      },
      { provide: ContactsService, useValue: { search } },
    ],
  });

  const navigate = vi.fn().mockResolvedValue(true);
  TestBed.inject(Router).navigate = navigate;

  const fixture = TestBed.createComponent(ContactsList);
  fixture.detectChanges();
  await settle();
  fixture.detectChanges();

  return { fixture, host: fixture.nativeElement as HTMLElement, navigate };
}

beforeEach(() => {
  vi.clearAllMocks();
  search.mockResolvedValue(ok(response()));
});

describe('ContactsList', () => {
  it('searches for the term already in the URL', async () => {
    await setup({ q: 'ada' });

    expect(search).toHaveBeenCalledWith('loc1', { query: 'ada' });
  });

  it('lists the contacts the server returned', async () => {
    const { host } = await setup();

    expect(host.textContent).toContain('Ada Lovelace');
    expect(host.textContent).toContain('ada@example.com');
    expect(host.textContent).toContain('Analytical Co');
  });

  it('links each contact to its own page', async () => {
    const { host } = await setup();

    const link = host.querySelector<HTMLAnchorElement>('a[href]');
    // A real anchor, not a row click handler: keyboard reachable and
    // openable in a new tab.
    expect(link?.textContent?.trim()).toBe('Ada Lovelace');
  });

  it('puts a new search in the URL rather than filtering in place', async () => {
    const { fixture, host, navigate } = await setup();

    const input = host.querySelector<HTMLInputElement>('.contacts__field input');
    if (input === null) throw new Error('No search input rendered');
    input.value = 'lovelace';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    host.querySelector<HTMLFormElement>('.contacts__search')?.dispatchEvent(new Event('submit'));

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0][1].queryParams).toEqual({ q: 'lovelace' });
  });

  it('clears the query parameter rather than sending an empty one', async () => {
    const { fixture, host, navigate } = await setup({ q: 'ada' });

    const input = host.querySelector<HTMLInputElement>('.contacts__field input');
    if (input === null) throw new Error('No search input rendered');
    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    host.querySelector<HTMLFormElement>('.contacts__search')?.dispatchEvent(new Event('submit'));

    // "?q=" round-trips into the box as a search nobody performed.
    expect(navigate.mock.calls[0][1].queryParams).toEqual({ q: null });
  });

  it('warns that a full page is not the whole list', async () => {
    search.mockResolvedValue(ok(response({ truncated: true })));

    const { host } = await setup();

    expect(host.querySelector('.contacts__notice')?.textContent).toContain('first page');
  });

  it('says no matches only when there were none', async () => {
    search.mockResolvedValue(ok(response({ contacts: [], query: 'zzz' })));

    const { host } = await setup({ q: 'zzz' });

    expect(host.textContent).toContain('No contacts matching "zzz"');
  });

  it('shows a failure as a failure, never as no contacts', async () => {
    search.mockResolvedValue({
      data: null,
      error: { message: 'GHL is not configured.', context: 'GET', status: 503 },
    });

    const { host } = await setup();

    expect(host.textContent).toContain('This client is not connected to GoHighLevel');
    expect(host.textContent).not.toContain('No contacts');
    expect(host.querySelector('app-data-table')).toBeNull();
  });
});
