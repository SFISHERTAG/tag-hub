import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { LeadsFunnelWidget } from './leads-funnel-widget';
import { GhlWidgetsService } from '../../services/ghl-widgets.service';
import { ok } from '../../../../core/models/api-result.model';
import type { ApiResult } from '../../../../core/models/api-result.model';
import type { LeadsFunnelResponse } from '../../services/ghl-widgets.model';

/**
 * The branch under test is the one that looks like success.
 *
 * `/api/dashboard/widgets/leads-funnel` answers **200** with
 * `funnel: { ok: false, message }` when GHL itself failed. `ApiResult.error` is
 * null in that case, so every generic transport check passes and a component
 * that trusts them renders an empty funnel as though it were a reading of an
 * empty pipeline. That is the "revoked token renders as $0 spend" pattern
 * CLAUDE.md's error contract exists to stop, and it is asserted here rather
 * than only described in a comment because it is invisible in manual testing:
 * the failure and a genuinely quiet week look identical on screen.
 *
 * `warnings` gets the same treatment for the same reason. A `truncated` funnel
 * carries real-looking counts that are all undercounts.
 */

const getLeadsFunnel = vi.fn<() => Promise<ApiResult<LeadsFunnelResponse>>>();

const STAGES = [
  { stage: 'Leads', count: 157 },
  { stage: 'Booked', count: 53 },
  { stage: 'Showed', count: 41 },
  { stage: 'Closed', count: 9 },
] as const;

function live(overrides: Partial<Extract<LeadsFunnelResponse, { source: 'live' }>> = {}) {
  return {
    source: 'live',
    days: 30,
    funnel: {
      ok: true,
      stages: STAGES,
      showRateDenominator: 48,
      dqBreakdown: { preCall: 5, onCall: 2 },
      truncated: false,
    },
    warnings: [],
    ...overrides,
  } satisfies LeadsFunnelResponse;
}

async function setup(body: LeadsFunnelResponse) {
  getLeadsFunnel.mockReset();
  getLeadsFunnel.mockResolvedValue(ok(body));

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [LeadsFunnelWidget],
    providers: [
      provideZonelessChangeDetection(),
      { provide: GhlWidgetsService, useValue: { getLeadsFunnel } },
    ],
  });

  const fixture = TestBed.createComponent(LeadsFunnelWidget);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return { fixture, host: fixture.nativeElement as HTMLElement };
}

function stageLabels(host: HTMLElement): (string | undefined)[] {
  return Array.from(host.querySelectorAll('.funnel__stage dt')).map((el) => el.textContent?.trim());
}

function stageCounts(host: HTMLElement): (string | undefined)[] {
  return Array.from(host.querySelectorAll('.funnel__stage dd')).map((el) => el.textContent?.trim());
}

describe('LeadsFunnelWidget', () => {
  it('renders the four stage counts', async () => {
    const { host } = await setup(live());
    expect(stageLabels(host)).toEqual(['Leads', 'Booked', 'Showed', 'Closed']);
    expect(stageCounts(host)).toEqual(['157', '53', '41', '9']);
  });

  it('treats funnel.ok === false inside a 200 as an error, not as an empty funnel', async () => {
    const { host } = await setup(
      live({ funnel: { ok: false, message: 'GHL rejected the token.' } }),
    );

    const error = host.querySelector('app-error-state');
    expect(error).not.toBeNull();
    expect(host.textContent).toContain('GHL rejected the token.');

    // The part that matters: no figures survive alongside the error.
    expect(host.querySelectorAll('.funnel__stage').length).toBe(0);
  });

  it('leaves the counts as figures, because a stage count has no full scale', async () => {
    const { host } = await setup(live());
    expect(host.querySelectorAll('app-hud-gauge').length).toBe(0);
  });

  it('renders a truncated warning in the flow, above the counts it qualifies', async () => {
    const message = 'Incomplete data. The contact fetch hit its page limit.';
    const { host } = await setup(
      live({
        funnel: {
          ok: true,
          stages: STAGES,
          showRateDenominator: 48,
          dqBreakdown: { preCall: 5, onCall: 2 },
          truncated: true,
        },
        warnings: [{ code: 'truncated', message }],
      }),
    );

    const warning = host.querySelector('.funnel__warning');
    const stages = host.querySelector('.funnel__stages');
    if (warning === null || stages === null) {
      throw new Error('Expected both the warning and the stages to render.');
    }
    expect(warning.textContent?.trim()).toBe(message);
    expect(warning.getAttribute('role')).toBe('note');
    expect(
      warning.compareDocumentPosition(stages) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('discloses sample data when the account has no GHL location', async () => {
    const { host } = await setup({
      source: 'sample',
      days: 30,
      stages: STAGES,
      sampleData: {
        isSample: true,
        fields: ['stages'],
        source: 'lib/dashboard/mock-metrics.ts#MOCK_METRICS',
        notice: 'Sample data. These are placeholders.',
      },
      warnings: [{ code: 'no_location', message: 'No GHL location is configured.' }],
    });

    expect(host.querySelector('app-sample-data-notice')).not.toBeNull();
    expect(stageCounts(host)).toEqual(['157', '53', '41', '9']);
  });

  it('surfaces a transport failure rather than rendering zeroes', async () => {
    getLeadsFunnel.mockReset();
    getLeadsFunnel.mockResolvedValue({
      data: null,
      error: { message: 'Network unreachable.', context: 'GET /api/dashboard/widgets/leads-funnel' },
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [LeadsFunnelWidget],
      providers: [
        provideZonelessChangeDetection(),
        { provide: GhlWidgetsService, useValue: { getLeadsFunnel } },
      ],
    });
    const fixture = TestBed.createComponent(LeadsFunnelWidget);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('app-error-state')).not.toBeNull();
    expect(host.querySelectorAll('.funnel__stage').length).toBe(0);
  });
});
