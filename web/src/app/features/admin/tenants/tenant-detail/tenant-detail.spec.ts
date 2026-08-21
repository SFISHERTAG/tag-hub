import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TenantDetail } from './tenant-detail';
import { AdminTenantsService } from '../../services/admin-tenants.service';
import { ok } from '../../../../core/models/api-result.model';
import type { ApiResult } from '../../../../core/models/api-result.model';
import type {
  SavedTenant,
  Tenant,
  TenantDetail as TenantDetailPayload,
  TenantSettings,
} from '../../services/admin-tenants.model';

/**
 * Story: a location with no record must not look like a configured one.
 *
 * `getTenant` fails closed with placeholder defaults, so without the separate
 * `exists` flag a never-configured location is indistinguishable from a real
 * one whose fields happen to match the placeholders — and the page would claim
 * to be editing something that is not there.
 *
 * The second theme is the Meta ids. They are trimmed and always sent, including
 * as `""`, because Firestore's `ignoreUndefinedProperties` makes an omitted
 * field a no-op under a merge write: an admin clearing a pixel id would watch
 * the old value come back.
 */

const TENANT: Tenant = {
  locationId: 'loc1',
  name: 'Acme Tax',
  services: {
    vslFunnel: true,
    adManagement: false,
    closingTeam: true,
    website: false,
    salesEnablement: false,
  },
  ownerModel: 'tag',
  metaAdAccountId: 'act_1',
  metaBusinessId: 'biz_1',
  metaPixelId: 'px_1',
};

const get = vi.fn<(locationId: string) => Promise<ApiResult<TenantDetailPayload>>>();
const save =
  vi.fn<(locationId: string, settings: TenantSettings) => Promise<ApiResult<SavedTenant>>>();

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function setup(payload: TenantDetailPayload = { tenant: TENANT, exists: true }) {
  get.mockReset();
  save.mockReset();
  get.mockResolvedValue(ok(payload));
  save.mockResolvedValue(ok({ tenant: payload.tenant }));

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [TenantDetail],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: AdminTenantsService, useValue: { get, save } },
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ locationId: 'loc1' })),
          snapshot: { paramMap: convertToParamMap({ locationId: 'loc1' }) },
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(TenantDetail);
  fixture.detectChanges();
  await settle();
  fixture.detectChanges();

  return { fixture, component: fixture.componentInstance };
}

describe('TenantDetail', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('seeds the form from the stored tenant', async () => {
    const { component } = await setup();

    expect(component['form'].getRawValue()).toEqual({
      vslFunnel: true,
      adManagement: false,
      closingTeam: true,
      website: false,
      salesEnablement: false,
      ownerModel: 'tag',
      metaAdAccountId: 'act_1',
      metaBusinessId: 'biz_1',
      metaPixelId: 'px_1',
    });
    expect(component['heading']()).toBe('Acme Tax');
  });

  it('says outright when there is no record yet, instead of showing placeholders as fact', async () => {
    const { component } = await setup({
      tenant: {
        locationId: 'loc-new',
        name: 'Tenant loc-new',
        services: {
          vslFunnel: false,
          adManagement: false,
          closingTeam: false,
          website: false,
          salesEnablement: false,
        },
        ownerModel: 'client',
      },
      exists: false,
    });

    expect(component['exists']()).toBe(false);
    expect(component['subtitle']()).toContain('no tenant record yet');
  });

  it('sends every Meta id, trimmed, including the ones cleared to empty', async () => {
    const { fixture, component } = await setup();

    component['form'].patchValue({
      metaAdAccountId: '  act_2  ',
      metaBusinessId: '',
      metaPixelId: '   ',
    });
    fixture.detectChanges();
    await component['save']();

    expect(save).toHaveBeenCalledWith('loc1', {
      services: {
        vslFunnel: true,
        adManagement: false,
        closingTeam: true,
        website: false,
        salesEnablement: false,
      },
      ownerModel: 'tag',
      metaAdAccountId: 'act_2',
      metaBusinessId: '',
      metaPixelId: '',
    });
  });

  it('never sends the tenant name, which syncs from GHL', async () => {
    const { component } = await setup();

    await component['save']();

    const settings = save.mock.calls[0][1] as unknown as Record<string, unknown>;
    expect(Object.keys(settings)).not.toContain('name');
  });

  it('takes the saved tenant from the response rather than assuming the form landed', async () => {
    const { component } = await setup({ tenant: TENANT, exists: false });
    save.mockResolvedValue(ok({ tenant: { ...TENANT, name: 'Acme Tax Advisory' } }));

    await component['save']();

    expect(component['heading']()).toBe('Acme Tax Advisory');
    expect(component['exists']()).toBe(true);
    expect(component['saved']()).toBe(true);
  });

  it('does not claim to have saved when the write was refused', async () => {
    const { component } = await setup();
    save.mockResolvedValue({
      data: null,
      error: {
        message: 'Invalid location id.',
        context: 'PUT /api/admin/tenants/loc1',
        status: 400,
      },
    });

    await component['save']();

    expect(component['saveError']()).toBe('Invalid location id.');
    expect(component['saved']()).toBe(false);
  });

  it('shows a failed load as a failure, not as a tenant with every service off', async () => {
    get.mockReset();
    save.mockReset();
    get.mockResolvedValue({
      data: null,
      error: { message: 'Firestore unavailable.', context: 'GET /api/admin/tenants/loc1' },
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [TenantDetail],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AdminTenantsService, useValue: { get, save } },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ locationId: 'loc1' })),
            snapshot: { paramMap: convertToParamMap({ locationId: 'loc1' }) },
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(TenantDetail);
    fixture.detectChanges();
    await settle();

    const component = fixture.componentInstance;
    expect(component['loadError']()).toBe('Firestore unavailable.');
    expect(component['tenant']()).toBeNull();
  });
});
