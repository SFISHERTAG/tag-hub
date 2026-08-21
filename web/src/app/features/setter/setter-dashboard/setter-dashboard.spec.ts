import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SetterDashboard } from './setter-dashboard';
import { SetterService } from '../services/setter.service';
import { ok } from '../../../core/models/api-result.model';
import type { ApiResult } from '../../../core/models/api-result.model';
import type { LeadMetric, SetterDashboardData } from '../services/setter.model';

/**
 * Story: this board carries one defect forward, and it is a defect of silence.
 *
 * The Next version polled a route that did not exist. Every refresh 404'd,
 * `response.ok` was false, the catch did nothing, and the board sat frozen on
 * its load-time data with nothing on screen to say so. On a queue whose entire
 * purpose is catching a two-minute window, a frozen board that looks live is
 * worse than a blank one — the setter keeps working a list that stopped moving.
 *
 * So the tests here are about what happens when the refresh fails: the
 * last-good queue is KEPT (a failed read is not evidence the queue emptied,
 * which is the same "$0 spend" inference the error contract exists to
 * prevent), and a warning names when the data is from and how long it has been
 * standing still.
 */

const LEADS: readonly LeadMetric[] = [
  {
    id: 'l1',
    name: 'Fresh Lead',
    email: 'fresh@example.com',
    createdAt: '2026-08-21T16:00:00.000Z',
    status: 'uncontacted',
    ageMinutes: 1,
    priority: 'urgent',
  },
  {
    id: 'l2',
    name: 'Old Lead',
    phone: '555-0100',
    createdAt: '2026-08-18T16:00:00.000Z',
    status: 'contacted',
    ageMinutes: 4300,
    priority: 'aged',
  },
];

function dashboard(overrides: Partial<SetterDashboardData> = {}): SetterDashboardData {
  return {
    locationId: 'loc1',
    setterEmail: 'setter@taxadvisorygrowth.net',
    refreshedAt: '2026-08-21T16:05:00.000Z',
    metrics: {
      totalLeadsToday: 9,
      contactedToday: 4,
      contactRate: 44,
      averageSpeedMinutes: 3,
      pendingCallbacks: 2,
      qualifiedLeads: 1,
      medianSpeedMinutes: 2,
    },
    leads: LEADS,
    ...overrides,
  };
}

const load = vi.fn<(locationId?: string) => Promise<ApiResult<SetterDashboardData>>>();

function upstreamFailure(): ApiResult<SetterDashboardData> {
  return {
    data: null,
    error: {
      message: 'Could not load this data from its source.',
      context: 'GET /api/setter/dashboard',
      status: 502,
    },
  };
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function setup() {
  load.mockReset();
  load.mockResolvedValue(ok(dashboard()));

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [SetterDashboard],
    providers: [
      provideZonelessChangeDetection(),
      { provide: SetterService, useValue: { load } },
    ],
  });

  const fixture = TestBed.createComponent(SetterDashboard);
  fixture.detectChanges();
  await settle();
  fixture.detectChanges();

  return { fixture, component: fixture.componentInstance };
}

describe('SetterDashboard', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the queue and shows no staleness warning', async () => {
    const { component } = await setup();

    expect(component['leads']()).toHaveLength(2);
    expect(component['freshLeads']()).toHaveLength(1);
    expect(component['agedCount']()).toBe(1);
    expect(component['staleLabel']()).toBeNull();
    expect(component['error']()).toBeNull();
  });

  it('KEEPS the last-good queue when a refresh fails, and says the board is not updating', async () => {
    // The defect, stated as a test. Emptying the board here would read as "all
    // caught up" over a real backlog.
    const { component } = await setup();

    load.mockResolvedValue(upstreamFailure());
    await component['refresh']();

    expect(component['leads']()).toHaveLength(2);
    expect(component['freshLeads']()).toHaveLength(1);

    const warning = component['staleLabel']();
    expect(warning).not.toBeNull();
    expect(warning).toContain('failing since');
    expect(warning).toContain('not updating');
    expect(component['staleReason']()).toBe('Could not load this data from its source.');
  });

  it('does not blank the screen on a failed refresh — the error state is for a failed FIRST load', async () => {
    const { component } = await setup();

    load.mockResolvedValue(upstreamFailure());
    await component['refresh']();

    expect(component['loading']()).toBe(false);
    expect(component['error']()).toBeNull();
  });

  it('reports how long the refresh has been failing, not "just now" on every attempt', async () => {
    const { component } = await setup();

    load.mockResolvedValue(upstreamFailure());
    await component['refresh']();
    const first = component['staleSince']();

    await component['refresh']();
    await component['refresh']();

    expect(component['staleSince']()).toBe(first);
  });

  it('clears the warning once a refresh succeeds again', async () => {
    const { component } = await setup();

    load.mockResolvedValue(upstreamFailure());
    await component['refresh']();
    expect(component['staleLabel']()).not.toBeNull();

    load.mockResolvedValue(ok(dashboard({ refreshedAt: '2026-08-21T16:20:00.000Z', leads: [] })));
    await component['refresh']();

    expect(component['staleLabel']()).toBeNull();
    expect(component['staleReason']()).toBeNull();
    expect(component['leads']()).toEqual([]);
  });

  it('polls the same location it loaded, so a refresh cannot drift to another client', async () => {
    const { component } = await setup();

    load.mockClear();
    load.mockResolvedValue(ok(dashboard()));
    await component['refresh']();

    expect(load).toHaveBeenCalledWith('loc1');
  });

  it('does not poll before the first load has ever succeeded', async () => {
    load.mockReset();
    load.mockResolvedValue(upstreamFailure());

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [SetterDashboard],
      providers: [
        provideZonelessChangeDetection(),
        { provide: SetterService, useValue: { load } },
      ],
    });

    const fixture = TestBed.createComponent(SetterDashboard);
    fixture.detectChanges();
    await settle();

    const component = fixture.componentInstance;
    expect(component['error']()).toBe('Could not load this data from its source.');

    load.mockClear();
    await component['refresh']();

    // Nothing to keep stale yet: a banner here would describe data that does
    // not exist, and the error state is already the honest screen.
    expect(load).not.toHaveBeenCalled();
    expect(component['staleLabel']()).toBeNull();
  });

  it('filters the queue by priority without touching the metric tiles', async () => {
    const { component } = await setup();

    expect(component['visibleLeads']().map((lead) => lead.id)).toEqual(['l1']);

    component['setFilter']('aged');
    expect(component['visibleLeads']().map((lead) => lead.id)).toEqual(['l2']);

    // The tiles read the whole queue, not the filtered view.
    expect(component['freshLeads']()).toHaveLength(1);
    expect(component['metrics']().contactedToday).toBe(4);
  });

  it('renders a missing speed reading as "-" rather than a plausible 0m', async () => {
    const { component } = await setup();

    expect(component['speed'](undefined)).toBe('-');
    expect(component['speed'](0)).toBe('-');
    expect(component['speed'](3)).toBe('3m');
    expect(component['speed'](95)).toBe('1h 35m');
  });

  it('falls back to a phone number, then to plain words, for a lead with no email', async () => {
    const { component } = await setup();

    expect(component['contact'](LEADS[0])).toBe('fresh@example.com');
    expect(component['contact'](LEADS[1])).toBe('555-0100');
    expect(component['contact']({ ...LEADS[1], phone: undefined })).toBe('No contact details');
  });
});
