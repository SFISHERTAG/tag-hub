import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FlowService } from './flow.service';
import { APP_CONFIG } from '../../../core/config/app-config';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';

/**
 * Story: a suggestion carries the org it belongs to, and the server checks both
 * halves of that claim.
 *
 * `org_id` in the body plus `cardId` in the path is not redundancy. The
 * endpoint verifies the caller has access to the org AND that the card actually
 * belongs to it — without the second check, a caller could pair their own valid
 * org id with another tenant's card id and plant a suggestion on a tenancy they
 * were never checked against.
 *
 * Field names stay snake_case because that is what the endpoints speak. A
 * camelCase mapping layer here would exist only to disagree with the network
 * tab.
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
    service: TestBed.inject(FlowService),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

describe('FlowService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the framework for one org', async () => {
    const { service, httpMock } = setup();

    const pending = service.framework('loc1');
    const request = httpMock.expectOne('/api/flow/org/loc1/framework');

    expect(request.request.method).toBe('GET');

    request.flush({ id: 'fw1', version: '1', tabs: [] });
    await pending;
    httpMock.verify();
  });

  it('asks only for pending suggestions', async () => {
    const { service, httpMock } = setup();

    const pending = service.pendingSuggestions('loc1');
    const request = httpMock.expectOne(
      (candidate) => candidate.url === '/api/flow/org/loc1/suggestions',
    );

    expect(request.request.params.get('status')).toBe('pending');

    request.flush([]);
    await pending;
    httpMock.verify();
  });

  it('sends the org alongside the card, in the shape the endpoint reads', async () => {
    const { service, httpMock } = setup();

    const pending = service.suggest({
      orgId: 'loc1',
      cardId: 'card-1',
      content: 'Try this opener instead.',
      note: 'Prospect went quiet.',
    });
    const request = httpMock.expectOne('/api/flow/card/card-1/suggestions');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      org_id: 'loc1',
      suggested_content: 'Try this opener instead.',
      suggestion_note: 'Prospect went quiet.',
    });

    request.flush({ id: 's1' }, { status: 201, statusText: 'Created' });
    await pending;
    httpMock.verify();
  });

  it('omits an empty note rather than sending an empty string', async () => {
    const { service, httpMock } = setup();

    const pending = service.suggest({
      orgId: 'loc1',
      cardId: 'card-1',
      content: 'Shorter close.',
      note: '',
    });
    const request = httpMock.expectOne('/api/flow/card/card-1/suggestions');

    expect((request.request.body as Record<string, unknown>)['suggestion_note']).toBeUndefined();

    request.flush({ id: 's1' }, { status: 201, statusText: 'Created' });
    await pending;
    httpMock.verify();
  });

  it('resolves a suggestion by its own id, with the action in the body', async () => {
    const { service, httpMock } = setup();

    const pending = service.resolve('s1', 'approve');
    const request = httpMock.expectOne('/api/flow/suggestions/s1/resolve');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ action: 'approve' });

    request.flush({ id: 's1', status: 'approved' });
    await pending;
    httpMock.verify();
  });

  it('reports a missing framework as a failure, not as a framework with no tabs', async () => {
    const { service, httpMock } = setup();

    const pending = service.framework('loc1');
    httpMock
      .expectOne('/api/flow/org/loc1/framework')
      .flush({ error: 'Framework not found' }, { status: 404, statusText: 'Not Found' });

    const result = await pending;

    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(404);
    httpMock.verify();
  });

  it('encodes an org id into the path', async () => {
    const { service, httpMock } = setup();

    const pending = service.framework('loc/1');
    httpMock.expectOne('/api/flow/org/loc%2F1/framework').flush({ id: 'x', version: '1', tabs: [] });

    await pending;
    httpMock.verify();
  });
});
