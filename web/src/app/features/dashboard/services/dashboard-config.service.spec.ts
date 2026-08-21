import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DashboardConfigService } from './dashboard-config.service';
import { APP_CONFIG } from '../../../core/config/app-config';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { ROLES } from '../../../core/models/role.model';
import type { DashboardConfig } from '../../../shared/widgets/widget.model';
import type { DashboardConfigResponse } from './dashboard.model';

/**
 * Story: the `?page=` parameter is the fix this endpoint exists to carry.
 *
 * In the Next app the page tabs linked to `/dashboard?page=<id>` and no code
 * ever read the parameter, so every tab rendered the saved current page and
 * multi-page dashboards did nothing. The parameter has to actually reach the
 * server, and it has to be absent when no page was asked for, so the server's
 * fallback to the saved page can happen.
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
    service: TestBed.inject(DashboardConfigService),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

function config(): DashboardConfig {
  return { role: ROLES.TAG_CSM, pages: [], currentPage: 0, updatedAt: 0 };
}

function response(overrides: Partial<DashboardConfigResponse> = {}): DashboardConfigResponse {
  return {
    config: config(),
    currentPageId: null,
    availableWidgets: [],
    removedWidgetIds: [],
    sampleDataWidgetIds: [],
    locationId: null,
    lastUpdated: { timestamp: null, source: null },
    ...overrides,
  };
}

describe('DashboardConfigService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends no page parameter when none was asked for', async () => {
    const { service, httpMock } = setup();

    const pending = service.load();
    const request = httpMock.expectOne('/api/dashboard/config');

    // Absent, not empty. `?page=` would be an unknown id rather than "use the
    // saved one", and the server's fallback would never run.
    expect(request.request.params.keys()).toEqual([]);

    request.flush(response());
    await pending;
    httpMock.verify();
  });

  it('forwards the requested page so tabs actually select a page', async () => {
    const { service, httpMock } = setup();

    const pending = service.load('growth');
    const request = httpMock.expectOne((candidate) => candidate.url === '/api/dashboard/config');

    expect(request.request.params.get('page')).toBe('growth');

    request.flush(response({ currentPageId: 'growth' }));
    await pending;
    httpMock.verify();
  });

  it('treats a null page id as no page rather than sending the string null', async () => {
    const { service, httpMock } = setup();

    const pending = service.load(null);
    const request = httpMock.expectOne('/api/dashboard/config');

    expect(request.request.params.keys()).toEqual([]);

    request.flush(response());
    await pending;
    httpMock.verify();
  });

  it('PUTs the layout to the same endpoint', async () => {
    const { service, httpMock } = setup();

    const layout = config();
    const pending = service.save(layout);
    const request = httpMock.expectOne('/api/dashboard/config');

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(layout);

    request.flush({ ok: true, config: layout });
    await pending;
    httpMock.verify();
  });

  it('surfaces a refused save as a typed error, not as a silent success', async () => {
    const { service, httpMock } = setup();

    const pending = service.save(config());
    httpMock.expectOne('/api/dashboard/config').flush(
      { message: 'Widget "team_health_rollup" is not available for this role.' },
      { status: 403, statusText: 'Forbidden' },
    );

    const result = await pending;

    // The entitlement boundary reporting for duty. The screen has to roll back
    // on this, which it cannot do if the failure arrives as a resolved value.
    expect(result.data).toBeNull();
    expect(result.error?.message).toContain('not available for this role');
    httpMock.verify();
  });
});
