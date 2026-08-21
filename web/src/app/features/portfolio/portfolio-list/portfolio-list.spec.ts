import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { PortfolioList } from './portfolio-list';
import { PortfolioService } from '../services/portfolio.service';
import { ImpersonationService } from '../../../core/services/impersonation.service';
import { ok } from '../../../core/models/api-result.model';
import type { Portfolio } from '../services/portfolio.model';
import type { ApiResult } from '../../../core/models/api-result.model';
import type { ImpersonationState, Session } from '../../../core/models/session.model';
import { ROLES } from '../../../core/models/role.model';

/**
 * Story: this screen has one behaviour worth defending above all others, and it
 * is the defect the story says must not come back.
 *
 * The Next version ran `Promise.all` over the tenant lookups. One unreachable
 * record rejected the batch, the page rendered "no clients assigned", and a CSM
 * whose whole day starts here was told their book was empty. So: a partial
 * failure shows the survivors AND says how many are missing, and a total
 * failure shows an error rather than an empty list. Those two cases are the
 * reason the rest of this file exists.
 *
 * The second theme is that entering a tenant is a server-side grant. The click
 * handler must not report success on its own, must not fire twice, and must not
 * report failure when the grant landed and only the destination route is
 * missing.
 */

const listTenants = vi.fn<() => Promise<ApiResult<Portfolio>>>();
const enter = vi.fn<(locationId: string) => Promise<ApiResult<Session>>>();

const impersonated = signal<ImpersonationState | null>(null);

function portfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    tenants: [
      { locationId: 'loc1', name: 'Acme' },
      { locationId: 'loc2', name: 'Beta' },
    ],
    unavailable: { count: 0, locationIds: [] },
    canEnter: true,
    ...overrides,
  };
}

function session(): Session {
  return {
    uid: 'u1',
    email: 'csm@taxadvisorygrowth.net',
    currentRole: ROLES.TAG_CSM,
    availableRoles: [ROLES.TAG_CSM],
    locations: ['loc1', 'loc2'],
    impersonation: { locationId: 'loc1' },
  };
}

/** A macrotask turn: flushes every microtask the component's load() queued. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [PortfolioList],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: PortfolioService, useValue: { listTenants } },
      {
        provide: ImpersonationService,
        useValue: { current: impersonated.asReadonly(), enter },
      },
    ],
  });

  const navigateByUrl = vi.fn().mockResolvedValue(true);
  TestBed.inject(Router).navigateByUrl = navigateByUrl;

  const fixture = TestBed.createComponent(PortfolioList);
  fixture.detectChanges();
  await settle();
  fixture.detectChanges();

  return { fixture, host: fixture.nativeElement as HTMLElement, navigateByUrl };
}

function cards(host: HTMLElement): HTMLElement[] {
  return Array.from(host.querySelectorAll<HTMLElement>('.portfolio__card'));
}

function enterButtons(host: HTMLElement): HTMLButtonElement[] {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('.portfolio__actions button'));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  impersonated.set(null);
  listTenants.mockResolvedValue(ok(portfolio()));
  enter.mockResolvedValue(ok(session()));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PortfolioList', () => {
  it('lists every tenant it was given', async () => {
    const { host } = await setup();

    expect(cards(host)).toHaveLength(2);
    expect(host.textContent).toContain('Acme');
    expect(host.textContent).toContain('loc1');
  });

  it('counts the clients in the subtitle, singular when there is one', async () => {
    listTenants.mockResolvedValue(
      ok(portfolio({ tenants: [{ locationId: 'loc1', name: 'Acme' }] })),
    );
    const { host } = await setup();

    expect(host.textContent).toContain('1 client');
    expect(host.textContent).not.toContain('1 clients');
  });

  it('does not empty the list when one tenant fails to load, and says how many are missing', async () => {
    // The carried-forward defect, in one test. Two of three tenants resolved;
    // both must render, and the third must be accounted for out loud.
    listTenants.mockResolvedValue(
      ok(portfolio({ unavailable: { count: 1, locationIds: ['loc3'] } })),
    );
    const { host } = await setup();

    expect(cards(host)).toHaveLength(2);
    const notice = host.querySelector('.portfolio__notice');
    expect(notice?.textContent).toContain('1 client could not be loaded');
    expect(notice?.textContent).toContain('is missing from this list');
  });

  it('pluralises the shortfall', async () => {
    listTenants.mockResolvedValue(
      ok(portfolio({ unavailable: { count: 3, locationIds: ['a', 'b', 'c'] } })),
    );
    const { host } = await setup();

    expect(host.querySelector('.portfolio__notice')?.textContent).toContain(
      '3 clients could not be loaded and are missing',
    );
  });

  it('says nothing about a shortfall when there is none', async () => {
    const { host } = await setup();

    expect(host.querySelector('.portfolio__notice')).toBeNull();
  });

  it('shows an empty state, not an error, for a genuinely empty book', async () => {
    listTenants.mockResolvedValue(ok(portfolio({ tenants: [] })));
    const { host } = await setup();

    expect(host.textContent).toContain('No clients assigned');
    expect(host.querySelector('app-error-state')).toBeNull();
  });

  it('shows the failure and no rows when the list cannot be loaded', async () => {
    listTenants.mockResolvedValue({
      data: null,
      error: {
        message: 'Sign in to continue.',
        context: 'GET /api/portfolio/tenants',
        status: 401,
      },
    });
    const { host } = await setup();

    expect(host.textContent).toContain('Sign in to continue.');
    // Never "no clients assigned" for a failure: that is the outage-as-fact bug.
    expect(host.textContent).not.toContain('No clients assigned');
    expect(cards(host)).toHaveLength(0);
  });

  it('re-requests the list when the error state asks to retry', async () => {
    listTenants.mockResolvedValueOnce({
      data: null,
      error: { message: 'Upstream timeout.', context: 'GET /api/portfolio/tenants', status: 500 },
    });
    const { fixture, host } = await setup();
    expect(host.textContent).toContain('Upstream timeout.');

    const retry = host.querySelector<HTMLButtonElement>('app-error-state button');
    retry?.click();
    await settle();
    fixture.detectChanges();

    expect(listTenants).toHaveBeenCalledTimes(2);
    expect(cards(host)).toHaveLength(2);
  });

  it('renders no enter action for a hat that cannot enter', async () => {
    listTenants.mockResolvedValue(ok(portfolio({ canEnter: false })));
    const { host } = await setup();

    expect(cards(host)).toHaveLength(2);
    expect(enterButtons(host)).toHaveLength(0);
  });

  it('enters the tenant that was clicked and opens its workspace', async () => {
    const { fixture, host, navigateByUrl } = await setup();

    enterButtons(host)[1].click();
    await settle();
    fixture.detectChanges();

    expect(enter).toHaveBeenCalledWith('loc2');
    expect(navigateByUrl).toHaveBeenCalledWith('/l/loc2/pipeline');
  });

  it('marks the tenant the session is already inside, with no button to re-enter it', async () => {
    impersonated.set({ locationId: 'loc1' });
    const { host } = await setup();

    expect(host.textContent).toContain('You are in this client');
    // Only the other tenant is enterable.
    expect(enterButtons(host)).toHaveLength(1);
  });

  it('surfaces a refused entry and stays put', async () => {
    enter.mockResolvedValue({
      data: null,
      error: {
        message: 'Only client services can enter a tenant.',
        context: 'POST /api/impersonation/enter',
        status: 403,
      },
    });
    const { fixture, host, navigateByUrl } = await setup();

    enterButtons(host)[0].click();
    await settle();
    fixture.detectChanges();

    expect(host.querySelector('.portfolio__error')?.textContent).toContain(
      'Only client services can enter a tenant.',
    );
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('does not report a failure when the grant landed and only the destination is missing', async () => {
    // The workspace route arrives with Story 10.5. Until it does, the entry has
    // still happened server-side and an audit entry has still been written, so
    // showing "that failed" would invite a second, duplicate entry.
    const { fixture, host, navigateByUrl } = await setup();
    navigateByUrl.mockRejectedValue(new Error('Cannot match any routes'));

    enterButtons(host)[0].click();
    await settle();
    fixture.detectChanges();

    expect(enter).toHaveBeenCalledWith('loc1');
    expect(host.querySelector('.portfolio__error')).toBeNull();
  });

  it('will not fire a second entry while one is in flight', async () => {
    let release: (value: ApiResult<Session>) => void = () => undefined;
    enter.mockReturnValue(
      new Promise<ApiResult<Session>>((resolve) => {
        release = resolve;
      }),
    );
    const { fixture, host } = await setup();

    const [first, second] = enterButtons(host);
    first.click();
    await settle();
    fixture.detectChanges();

    // Every other tenant's button is disabled for the duration, so a double
    // click cannot open two impersonations or write two audit entries.
    expect(second.disabled).toBe(true);
    second.click();
    await settle();

    expect(enter).toHaveBeenCalledTimes(1);
    release(ok(session()));
    await settle();
  });
});
