import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ClientsBook } from './clients-book';
import { ClientsService } from '../services/clients.service';
import { ImpersonationService } from '../../../core/services/impersonation.service';
import { ok } from '../../../core/models/api-result.model';
import type { ApiResult } from '../../../core/models/api-result.model';
import type {
  ClientBookQuery,
  ClientBookResponse,
  ClientData,
  ClientStatus,
} from '../services/client.model';

/**
 * Story: this screen decides what a CSM believes about their own book, so the
 * two failures worth defending against are both about telling them something
 * untrue.
 *
 * 1. A failed load must never render as an empty book. During an outage the
 *    screen has to say "we could not load this", not "you have no clients".
 * 2. "No clients assigned" and "no clients match your filters" are different
 *    sentences with different fixes, and the screen has to pick the right one.
 *
 * The third theme is quieter and just as real: typing in the search box fires
 * overlapping requests, and if a slow earlier reply lands last, the list stops
 * matching the box. That one is invisible until someone acts on the wrong rows.
 */

const listClients = vi.fn<(query?: ClientBookQuery) => Promise<ApiResult<ClientBookResponse>>>();

function client(id: string, status: ClientStatus = 'healthy'): ClientData {
  return {
    id,
    name: `Client ${id}`,
    ghl_location_id: `loc-${id}`,
    csm_assigned: 'csm@taxadvisorygrowth.net',
    health: {
      clientId: id,
      score: 80,
      status,
      roas_score: 85,
      spend_score: 100,
      leads_score: 50,
      sla_score: 85,
      alert_count: 0,
      last_updated: '2026-08-01T00:00:00.000Z',
      is_sample: true,
    },
    alert_count: 0,
    metrics: { roas: 95, spend: 102, leads: 88, sla: 97 },
    metrics_are_sample: true,
    escalation: { bucket: 'no-action-needed', reason: null, daysSinceLastCheckIn: 3 },
  };
}

function book(clients: ClientData[]): ClientBookResponse {
  return {
    scope: 'mine',
    csmEmail: 'csm@taxadvisorygrowth.net',
    clients,
    total: clients.length,
    sampleData: {
      isSample: true,
      fields: ['clients[].health'],
      source: 'lib/dashboard/mock-metrics.ts#getMockMetrics',
      notice: 'Sample data. Health scores are placeholders.',
    },
  };
}

/** A macrotask turn: flushes every microtask the component's load() queued. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [ClientsBook],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: ClientsService, useValue: { listClients } },
      {
        provide: ImpersonationService,
        useValue: { current: () => null, enter: vi.fn() },
      },
    ],
  });

  const fixture = TestBed.createComponent(ClientsBook);
  fixture.detectChanges();
  await settle();
  fixture.detectChanges();

  return { fixture, text: () => fixture.nativeElement.textContent ?? '' };
}

describe('ClientsBook', () => {
  beforeEach(() => {
    listClients.mockReset();
    listClients.mockResolvedValue(ok(book([client('a'), client('b')])));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the book and says how many clients are in it', async () => {
    const { text } = await setup();

    expect(text()).toContain('Client a');
    expect(text()).toContain('2 clients');
  });

  it('shows the sample-data disclosure the server sent, verbatim', async () => {
    const { text } = await setup();

    // The carried-forward defect: every health score is fabricated and
    // identical for every client, so any surface showing one must say so.
    expect(text()).toContain('Sample data. Health scores are placeholders.');
  });

  it('renders a failure as an error, never as an empty book', async () => {
    listClients.mockResolvedValue({
      data: null,
      error: { message: 'Firestore is unreachable.', context: '/api/clients', status: 503 },
    });

    const { text } = await setup();

    expect(text()).toContain('Firestore is unreachable.');
    expect(text()).not.toContain('No clients assigned yet');
  });

  it('drops stale rows when a later load fails, rather than leaving them on screen', async () => {
    const { fixture, text } = await setup();
    expect(text()).toContain('Client a');

    listClients.mockResolvedValue({
      data: null,
      error: { message: 'Gone away.', context: '/api/clients' },
    });

    fixture.componentInstance['load']();
    await settle();
    fixture.detectChanges();

    // Rows behind an error look current. They are not.
    expect(text()).not.toContain('Client a');
    expect(text()).toContain('Gone away.');
  });

  it('distinguishes an empty book from an empty filter result', async () => {
    listClients.mockResolvedValue(ok(book([])));

    const { fixture, text } = await setup();
    expect(text()).toContain('No clients assigned yet');

    fixture.componentInstance['setStatus']('critical');
    await settle();
    fixture.detectChanges();

    expect(text()).toContain('No clients match your filters');
    expect(text()).not.toContain('No clients assigned yet');
  });

  it('asks the server to filter and sort, rather than filtering what it already has', async () => {
    const { fixture } = await setup();

    fixture.componentInstance['setStatus']('at-risk');
    await settle();

    expect(listClients).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'at-risk', sortBy: 'name', sortOrder: 'asc' }),
    );
  });

  it('ignores an out-of-order response so the list matches the query', async () => {
    const { fixture, text } = await setup();

    let releaseSlow: (value: ApiResult<ClientBookResponse>) => void = () => undefined;
    const slow = new Promise<ApiResult<ClientBookResponse>>((resolve) => {
      releaseSlow = resolve;
    });

    listClients.mockReturnValueOnce(slow);
    fixture.componentInstance['setStatus']('critical');

    listClients.mockResolvedValueOnce(ok(book([client('fresh', 'alert')])));
    fixture.componentInstance['setStatus']('alert');
    await settle();
    fixture.detectChanges();

    // The first request now answers, late, with the wrong rows.
    releaseSlow(ok(book([client('stale', 'critical')])));
    await settle();
    fixture.detectChanges();

    expect(text()).toContain('Client fresh');
    expect(text()).not.toContain('Client stale');
  });

  it('resets to the default sort when a table header clears its direction', async () => {
    const { fixture } = await setup();

    fixture.componentInstance['onTableSort']({ active: 'health', direction: 'desc' });
    await settle();
    expect(listClients).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: 'health', sortOrder: 'desc' }),
    );

    fixture.componentInstance['onTableSort']({ active: 'health', direction: '' });
    await settle();

    // An empty sortBy is a 400 at the endpoint, not "no sort".
    expect(listClients).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: 'name', sortOrder: 'asc' }),
    );
  });

  it('refuses a sort key the endpoint does not accept', async () => {
    const { fixture } = await setup();

    fixture.componentInstance['onTableSort']({ active: 'alerts', direction: 'asc' });
    await settle();

    expect(listClients).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: 'name', sortOrder: 'asc' }),
    );
  });

  it('falls back to a legal value when a control hands it something else', async () => {
    const { fixture } = await setup();

    // Material types MatSelect's valueChange and MatButtonToggleChange.value as
    // `any`, so strictTemplates cannot check what a binding passes. These
    // narrow at the handler; the failure mode without it is an unrecognised
    // string reaching the endpoint and coming back a 400.
    fixture.componentInstance['setStatus']('not-a-status');
    await settle();
    expect(listClients).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'all' }));

    fixture.componentInstance['setSortBy'](42);
    await settle();
    expect(listClients).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: 'name' }));
  });

  it('clears both filters together, so the empty state cannot lie', async () => {
    const { fixture } = await setup();

    fixture.componentInstance['setStatus']('critical');
    await settle();

    fixture.componentInstance['clearFilters']();
    await settle();

    expect(fixture.componentInstance['hasFilters']()).toBe(false);
    expect(listClients).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'all', search: '' }),
    );
  });
});
