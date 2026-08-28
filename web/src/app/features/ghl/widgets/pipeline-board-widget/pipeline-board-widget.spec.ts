import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { PipelineBoardWidget } from './pipeline-board-widget';
import { GhlWidgetsService } from '../../services/ghl-widgets.service';
import { ok } from '../../../../core/models/api-result.model';
import type { ApiResult } from '../../../../core/models/api-result.model';
import type { PipelineBoardResponse } from '../../services/ghl-widgets.model';

/**
 * The two arms of this endpoint carry different information, not the same
 * information twice, so the tests assert that each renders its own view and
 * that neither leaks into the other. Flattening them would mean deriving
 * per-stage counts from a deal list, which is fabrication.
 *
 * `pipeline.ok === false` inside an HTTP 200 gets the same treatment as the
 * other three widgets in this folder. It covers "no pipeline found for this
 * location" as well as a GHL outage, so it is not a rare path.
 */

const getPipelineBoard = vi.fn<() => Promise<ApiResult<PipelineBoardResponse>>>();

function liveBody(): PipelineBoardResponse {
  return {
    source: 'live',
    pipeline: {
      ok: true,
      pipelineName: 'Advisory Pipeline',
      stages: [
        { id: 's1', name: 'Discovery', count: 12, value: 48000 },
        { id: 's2', name: 'Proposal', count: 5, value: 92500 },
      ],
    },
    warnings: [],
  };
}

async function setup(body: PipelineBoardResponse) {
  getPipelineBoard.mockReset();
  getPipelineBoard.mockResolvedValue(ok(body));

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [PipelineBoardWidget],
    providers: [
      provideZonelessChangeDetection(),
      { provide: GhlWidgetsService, useValue: { getPipelineBoard } },
    ],
  });

  const fixture = TestBed.createComponent(PipelineBoardWidget);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return { fixture, host: fixture.nativeElement as HTMLElement };
}

describe('PipelineBoardWidget', () => {
  it('renders the live stage rollup with the pipeline name', async () => {
    const { host } = await setup(liveBody());
    expect(host.querySelector('.pipeline__name')?.textContent?.trim()).toBe('Advisory Pipeline');
    const names = Array.from(host.querySelectorAll('.pipeline__stage-name')).map((el) =>
      el.textContent?.trim(),
    );
    expect(names).toEqual(['Discovery', 'Proposal']);
    // The host element is always rendered; the notice self-hides inside it. Only
    // `.sample-notice` distinguishes disclosed from undisclosed.
    expect(host.querySelector('.sample-notice')).toBeNull();
  });

  it('renders stage values as the server sent them, formatted not computed', async () => {
    const { host } = await setup(liveBody());
    const values = Array.from(host.querySelectorAll('.pipeline__stage-value')).map((el) =>
      el.textContent?.trim(),
    );
    // No total is summed and no currency converted; 48000 and 92500 unchanged.
    expect(values).toEqual(['$48,000', '$92,500']);
  });

  it('treats pipeline.ok === false inside a 200 as an error, not an empty board', async () => {
    const { host } = await setup({
      source: 'live',
      pipeline: { ok: false, message: 'No pipeline found for this location.' },
      warnings: [],
    });
    expect(host.querySelector('app-error-state')).not.toBeNull();
    expect(host.querySelectorAll('.pipeline__stage').length).toBe(0);
    expect(host.querySelector('app-empty-state')).toBeNull();
  });

  it('renders the sample arm as top deals, and discloses it', async () => {
    const { host } = await setup({
      source: 'sample',
      topDeals: [
        { name: 'Lakemore Advisory Group', value: 24500, stage: 'Closed' },
        { name: 'Summit Ridge CPAs', value: 15200, stage: 'Booked' },
      ],
      sampleData: {
        isSample: true,
        fields: ['topDeals'],
        source: 'lib/dashboard/mock-metrics.ts#MOCK_METRICS',
        notice: 'Sample data. These are placeholders.',
      },
      warnings: [{ code: 'no_location', message: 'No GHL location is configured.' }],
    });

    expect(host.querySelector('.sample-notice')?.textContent).toContain(
      'Sample data. These are placeholders.',
    );
    expect(host.querySelector('.pipeline__name')?.textContent?.trim()).toBe('Top deals');
    const names = Array.from(host.querySelectorAll('.pipeline__stage-name')).map((el) =>
      el.textContent?.trim(),
    );
    expect(names).toEqual(['Lakemore Advisory Group', 'Summit Ridge CPAs']);
  });

  it('shows a live pipeline with no stages as empty, not as an error', async () => {
    const { host } = await setup({
      source: 'live',
      pipeline: { ok: true, pipelineName: 'Empty Pipeline', stages: [] },
      warnings: [],
    });
    expect(host.querySelector('app-empty-state')).not.toBeNull();
    expect(host.querySelector('app-error-state')).toBeNull();
  });
});
