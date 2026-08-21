import { TestBed } from '@angular/core/testing';
import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { OverviewTab } from './overview-tab';
import { ClientsService } from '../../../services/clients.service';
import { ok } from '../../../../../core/models/api-result.model';
import type { ApiResult } from '../../../../../core/models/api-result.model';
import type { ClientAlertsResponse, ClientData } from '../../../services/client.model';

/**
 * The four health components are dials now, and the risk that came with that
 * is the point of these tests: an arc reads as more authoritative than the
 * bare figure it replaced, while the numbers behind it are still fabricated.
 *
 * So the assertions are about the dial telling the truth. Each one has to
 * carry its own component's score, not a neighbour's, and the reading has to
 * survive into the accessible name because the SVG itself is aria-hidden — a
 * dial that renders correctly and announces nothing is a silent screen for
 * anyone not looking at it.
 */

const getAlerts = vi.fn<(id: string) => Promise<ApiResult<ClientAlertsResponse>>>();

function client(): ClientData {
  return {
    id: 'c-1',
    name: 'Client One',
    ghl_location_id: 'loc-1',
    csm_assigned: 'csm@taxadvisorygrowth.net',
    health: {
      clientId: 'c-1',
      score: 74,
      status: 'healthy',
      roas_score: 85,
      spend_score: 100,
      leads_score: 50,
      sla_score: 62,
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

async function setup() {
  getAlerts.mockReset();
  getAlerts.mockResolvedValue(ok({ clientId: 'c-1', alerts: [] }));

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [OverviewTab],
    providers: [
      provideZonelessChangeDetection(),
      { provide: ClientsService, useValue: { getAlerts } },
    ],
  });

  const fixture = TestBed.createComponent(OverviewTab);
  fixture.componentRef.setInput('client', client());
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return { fixture, host: fixture.nativeElement as HTMLElement };
}

describe('OverviewTab health components', () => {
  it('draws one dial per component', async () => {
    const { host } = await setup();
    expect(host.querySelectorAll('app-hud-gauge').length).toBe(4);
  });

  it('gives each dial its own component score, in order', async () => {
    const { host } = await setup();
    const labels = Array.from(host.querySelectorAll('.hud-gauge')).map((g) =>
      g.getAttribute('aria-label'),
    );
    expect(labels).toEqual(['ROAS: 85', 'Budget: 100', 'Leads: 50', 'SLA: 62']);
  });

  it('keeps the underlying attainment figure alongside the dial', async () => {
    const { host } = await setup();
    expect(host.querySelectorAll('.overview__score-meta').length).toBe(4);
  });

  it('announces each reading, since the svg is hidden from assistive tech', async () => {
    const { host } = await setup();
    for (const svg of Array.from(host.querySelectorAll('.hud-gauge svg'))) {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    }
    for (const gauge of Array.from(host.querySelectorAll('.hud-gauge'))) {
      expect(gauge.getAttribute('aria-label')).toBeTruthy();
    }
  });
});

/**
 * Regression test for the alerts panel that spun forever.
 *
 * The constructor used to call `void this.load()`, which read the required
 * `client` input before Angular had bound it. That threw NG0950 inside an async
 * function, so the rejection went to `void` and disappeared: getAlerts was
 * never called and `loading` was never cleared, leaving the panel showing its
 * skeleton for good. It read as a slow request rather than a dead one, which is
 * how it survived having no test.
 *
 * This binds through a host template rather than `setInput`, because that is
 * the ordering the real client-detail.html produces and the only one that would
 * have caught it. Counting the calls is the assertion that matters: asserting
 * on rendered alerts would pass just as well against a panel that never asked.
 */
@Component({
  imports: [OverviewTab],
  template: `<app-overview-tab [client]="c()" />`,
})
class AlertsHost {
  readonly c = signal(client());
}

describe('OverviewTab alerts loading', () => {
  async function hosted() {
    getAlerts.mockReset();
    getAlerts.mockResolvedValue(ok({ clientId: 'c-1', alerts: [] }));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AlertsHost],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ClientsService, useValue: { getAlerts } },
      ],
    });

    const fixture = TestBed.createComponent(AlertsHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  it('actually asks for the alerts when bound from a template', async () => {
    await hosted();
    expect(getAlerts.mock.calls.length).toBe(1);
    expect(getAlerts.mock.calls[0][0]).toBe('c-1');
  });

  it('clears the loading state instead of showing the skeleton forever', async () => {
    const { host } = await hosted();
    expect(host.querySelector('app-loading-state')).toBeNull();
  });

  it('reloads when the tab is pointed at a different client', async () => {
    const { fixture } = await hosted();
    const next = client();
    fixture.componentInstance.c.set({ ...next, id: 'c-2' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(getAlerts.mock.calls.length).toBe(2);
    expect(getAlerts.mock.calls[1][0]).toBe('c-2');
  });
});
