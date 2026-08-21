import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { DepartmentOverviewWidget } from './department-overview-widget';
import { ClientWidgetsService } from '../../services/client-widgets.service';
import { ok } from '../../../../core/models/api-result.model';
import type { ApiResult } from '../../../../core/models/api-result.model';
import type { DepartmentOverviewResponse } from '../../services/client.model';

/**
 * One dial, three figures, and the split is the thing under test.
 *
 * `avgHealthScore` is a 0-100 score, so an arc is a real proportion of full
 * scale. The other three are counts, and a count has no full scale: putting
 * one on a dial means inventing a maximum, after which the arc implies a
 * ceiling nobody set. Eleven clients drawn against an assumed hundred reads as
 * a near-empty department to anyone glancing at it.
 *
 * That is easy to undo by accident later, which is why it is asserted rather
 * than only written in a comment.
 */

const getDepartmentOverview = vi.fn<() => Promise<ApiResult<DepartmentOverviewResponse>>>();

function response(avgHealthScore = 68): DepartmentOverviewResponse {
  return {
    summary: {
      totalClients: 11,
      csmCount: 3,
      avgHealthScore,
      needsAttentionCount: 4,
      ascensionReadyCount: 2,
      escalationAtRiskCount: 1,
      booksByRisk: [],
    },
    sampleData: {
      isSample: true,
      notice: 'Health scores are sample data.',
      fields: ['client.health'],
      source: 'lib/dashboard/mock-metrics.ts#getMockMetrics',
    },
  };
}

async function setup(avgHealthScore = 68) {
  getDepartmentOverview.mockReset();
  getDepartmentOverview.mockResolvedValue(ok(response(avgHealthScore)));

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [DepartmentOverviewWidget],
    providers: [
      provideZonelessChangeDetection(),
      { provide: ClientWidgetsService, useValue: { getDepartmentOverview } },
    ],
  });

  const fixture = TestBed.createComponent(DepartmentOverviewWidget);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return { fixture, host: fixture.nativeElement as HTMLElement };
}

describe('DepartmentOverviewWidget', () => {
  it('puts the average health score on the dial', async () => {
    const { host } = await setup(68);
    const gauges = host.querySelectorAll('app-hud-gauge');
    expect(gauges.length).toBe(1);
    expect(host.querySelector('.hud-gauge')?.getAttribute('aria-label')).toBe(
      'Avg health score: 68',
    );
  });

  it('leaves the counts as figures, because a count has no full scale', async () => {
    const { host } = await setup();
    const labels = Array.from(host.querySelectorAll('.department__tile dt')).map(
      (el) => el.textContent?.trim(),
    );
    expect(labels).toEqual(['Total clients', 'Need attention', 'Ascension ready']);
    expect(host.querySelectorAll('.department__tile app-hud-gauge').length).toBe(0);
  });

  it('discloses the sample data above the dial, not below it', async () => {
    const { host } = await setup();
    const notice = host.querySelector('app-sample-data-notice');
    const dial = host.querySelector('app-hud-gauge');
    if (notice === null || dial === null) {
      throw new Error('Expected both the disclosure and the dial to render.');
    }
    // compareDocumentPosition: FOLLOWING means the dial comes after the notice.
    expect(notice.compareDocumentPosition(dial) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
