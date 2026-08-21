import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminTenantsService } from './admin-tenants.service';
import {
  SERVICE_IDS,
  enabledServiceCount,
  isValidLocationId,
  type Tenant,
} from './admin-tenants.model';
import { APP_CONFIG } from '../../../core/config/app-config';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';

/**
 * Story: a cleared Meta id must actually clear.
 *
 * Firestore is configured with `ignoreUndefinedProperties`, which makes an
 * absent field a no-op under a merge write. So an admin who deletes a pixel id
 * and saves would watch the old value come back on reload — the write looked
 * like it worked and changed nothing. The empty string has to be on the wire.
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
    service: TestBed.inject(AdminTenantsService),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

const ALL_OFF = {
  vslFunnel: false,
  adManagement: false,
  closingTeam: false,
  website: false,
  salesEnablement: false,
};

describe('AdminTenantsService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends an empty Meta id as "" so clearing it is a real change', async () => {
    const { service, httpMock } = setup();

    const pending = service.save('loc1', {
      services: { ...ALL_OFF, adManagement: true },
      ownerModel: 'tag',
      metaAdAccountId: '',
      metaBusinessId: '',
      metaPixelId: '',
    });
    const request = httpMock.expectOne('/api/admin/tenants/loc1');
    const body = request.request.body as Record<string, unknown>;

    expect(request.request.method).toBe('PUT');
    expect(body['metaPixelId']).toBe('');
    expect(body['metaBusinessId']).toBe('');
    expect(body['metaAdAccountId']).toBe('');

    request.flush({ tenant: {} });
    await pending;
    httpMock.verify();
  });

  it('never sends the tenant name — it syncs from GHL and is not writable here', async () => {
    const { service, httpMock } = setup();

    const pending = service.save('loc1', {
      services: ALL_OFF,
      ownerModel: 'client',
      metaAdAccountId: 'act_1',
      metaBusinessId: 'biz_1',
      metaPixelId: 'px_1',
    });
    const request = httpMock.expectOne('/api/admin/tenants/loc1');

    expect(Object.keys(request.request.body as object)).not.toContain('name');
    expect(Object.keys(request.request.body as object)).not.toContain('locationId');

    request.flush({ tenant: {} });
    await pending;
    httpMock.verify();
  });

  it('encodes a location id into the path', async () => {
    const { service, httpMock } = setup();

    const pending = service.get('loc/1');
    httpMock.expectOne('/api/admin/tenants/loc%2F1').flush({ tenant: {}, exists: false });

    await pending;
    httpMock.verify();
  });

  it('keeps "does this record exist" separate from the fail-closed defaults', async () => {
    const { service, httpMock } = setup();

    const pending = service.get('loc-new');
    httpMock.expectOne('/api/admin/tenants/loc-new').flush({
      tenant: { locationId: 'loc-new', name: 'Tenant loc-new', services: ALL_OFF, ownerModel: 'client' },
      exists: false,
    });

    const result = await pending;

    // Without this flag a never-configured location is indistinguishable from a
    // real one whose fields happen to match the placeholders.
    expect(result.data?.exists).toBe(false);
    expect(result.data?.tenant.name).toBe('Tenant loc-new');
    httpMock.verify();
  });

  it('reports a failed list read as a failure, not as a project with no tenants', async () => {
    const { service, httpMock } = setup();

    const pending = service.list();
    httpMock
      .expectOne('/api/admin/tenants')
      .flush(null, { status: 500, statusText: 'Server Error' });

    const result = await pending;

    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(500);
    httpMock.verify();
  });
});

describe('tenant model helpers', () => {
  it('accepts the ids GHL issues and rejects anything that could change a Firestore path', () => {
    expect(isValidLocationId('loc_ABC-123')).toBe(true);
    expect(isValidLocationId('loc/1')).toBe(false);
    expect(isValidLocationId('')).toBe(false);
    expect(isValidLocationId('a'.repeat(129))).toBe(false);
  });

  it('counts only the services that are on', () => {
    const tenant: Tenant = {
      locationId: 'loc1',
      name: 'Acme',
      services: { ...ALL_OFF, adManagement: true, website: true },
      ownerModel: 'client',
    };

    expect(enabledServiceCount(tenant)).toBe(2);
    expect(SERVICE_IDS).toHaveLength(5);
  });
});
