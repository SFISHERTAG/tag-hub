import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ContactsService } from './contacts.service';
import { APP_CONFIG } from '../../../core/config/app-config';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';

/**
 * Story: search happens at GoHighLevel, and a note write answers with the truth
 * it just created.
 *
 * A blank query must not become `?q=`, because the URL of this screen is what
 * people paste to each other and an empty parameter round-trips into the search
 * box as a search nobody performed.
 *
 * And `addNote` returns the refreshed list rather than an acknowledgement. That
 * is the endpoint's contract and this pins it: a caller that had to re-read
 * would render a list without the note it just wrote for as long as the second
 * request took.
 */

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([errorInterceptor])),
      provideHttpClientTesting(),
      { provide: APP_CONFIG, useValue: { production: false, apiBaseUrl: '', googleClientId: '' } },
    ],
  });

  return {
    service: TestBed.inject(ContactsService),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

describe('ContactsService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('omits the query entirely when nothing was typed', async () => {
    const { service, httpMock } = setup();

    const pending = service.search('loc1');
    const request = httpMock.expectOne(
      (candidate) => candidate.url === '/api/ghl/locations/loc1/contacts',
    );

    expect(request.request.params.keys()).toEqual(['limit']);
    expect(request.request.params.get('q')).toBeNull();

    request.flush({ query: null, limit: 50, contacts: [], truncated: false });
    await pending;
    httpMock.verify();
  });

  it('trims a query before sending it', async () => {
    const { service, httpMock } = setup();

    const pending = service.search('loc1', { query: '  acme  ' });
    const request = httpMock.expectOne(
      (candidate) => candidate.url === '/api/ghl/locations/loc1/contacts',
    );

    expect(request.request.params.get('q')).toBe('acme');

    request.flush({ query: 'acme', limit: 50, contacts: [], truncated: false });
    await pending;
    httpMock.verify();
  });

  it('keeps a whitespace-only query out of the URL', async () => {
    const { service, httpMock } = setup();

    const pending = service.search('loc1', { query: '   ' });
    const request = httpMock.expectOne(
      (candidate) => candidate.url === '/api/ghl/locations/loc1/contacts',
    );

    expect(request.request.params.get('q')).toBeNull();

    request.flush({ query: null, limit: 50, contacts: [], truncated: false });
    await pending;
    httpMock.verify();
  });

  it('returns the refreshed note list from the write itself', async () => {
    const { service, httpMock } = setup();

    const pending = service.addNote('loc1', 'c1', 'Left a voicemail');
    const request = httpMock.expectOne('/api/ghl/locations/loc1/contacts/c1/notes');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ body: 'Left a voicemail' });

    request.flush({ notes: [{ id: 'n2', body: 'Left a voicemail' }, { id: 'n1', body: 'Older' }] });

    const result = await pending;

    expect(result.error).toBeNull();
    expect(result.data?.notes).toHaveLength(2);
    httpMock.verify();
  });

  it('encodes a contact id into the path', async () => {
    const { service, httpMock } = setup();

    const pending = service.prep('loc1', 'c/1');
    httpMock.expectOne('/api/ghl/locations/loc1/contacts/c%2F1/prep').flush({
      contact: { id: 'c/1', displayName: 'Ada' },
      notes: [],
      opportunity: null,
    });

    await pending;
    httpMock.verify();
  });

  it('surfaces a missing contact as an error rather than an empty one', async () => {
    const { service, httpMock } = setup();

    const pending = service.detail('loc1', 'gone');
    httpMock
      .expectOne('/api/ghl/locations/loc1/contacts/gone')
      .flush({ message: 'Contact not found.', status: 404 }, { status: 404, statusText: 'Not Found' });

    const result = await pending;

    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(404);
    httpMock.verify();
  });
});
