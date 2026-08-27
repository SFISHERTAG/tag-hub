import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SampleDataNotice,
  type SampleDataDisclosure,
} from '../../../../shared/ui';
import { GhlWidgetsService } from '../../services/ghl-widgets.service';
import type {
  PipelineStageRollup,
  TopDeal,
  WidgetWarning,
} from '../../services/ghl-widgets.model';

/**
 * `pipeline_board` — the first open pipeline, rolled up by stage.
 *
 * ## Two arms, two different views, and that is the payload's doing
 *
 * `source: 'live'` returns a stage rollup: count and value per stage.
 * `source: 'sample'` returns a list of top deals. These are **not** the same
 * information in two dresses, so this renders two layouts rather than one
 * layout fed from two places. Flattening them into a common shape would mean
 * inventing per-stage counts from a deal list, which is fabrication.
 *
 * The consequence is worth stating out loud because it is surprising: the tile
 * shows a genuinely different thing when no GHL location is configured. The
 * sample disclosure and the `no_location` warning both render, so it says so.
 *
 * ## The 200 that carries a failure
 *
 * Third instance of the same shape on this endpoint family. `pipeline.ok ===
 * false` arrives inside an HTTP 200 with `ApiResult.error` null, and it covers
 * "no pipeline found for this location" as well as a GHL outage. An empty
 * board and an unreadable one are different states.
 *
 * ## Money is the server's number
 *
 * `value` is rendered with `Intl.NumberFormat` in the browser, which is a
 * presentation choice and not a computation: no total is summed here and no
 * currency is converted. The stage values are exactly what the server sent.
 */
@Component({
  selector: 'app-pipeline-board-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState, ErrorState, LoadingState, SampleDataNotice],
  templateUrl: './pipeline-board-widget.html',
  styleUrl: './pipeline-board-widget.scss',
})
export class PipelineBoardWidget {
  private readonly widgets = inject(GhlWidgetsService);

  private readonly money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly warnings = signal<readonly WidgetWarning[]>([]);
  protected readonly sampleData = signal<SampleDataDisclosure | null>(null);

  protected readonly pipelineName = signal<string | null>(null);
  protected readonly stages = signal<readonly PipelineStageRollup[] | null>(null);
  protected readonly topDeals = signal<readonly TopDeal[] | null>(null);

  protected readonly stageRows = computed(() =>
    (this.stages() ?? []).map((stage) => ({
      id: stage.id,
      name: stage.name,
      count: stage.count,
      value: this.money.format(stage.value),
    })),
  );

  protected readonly dealRows = computed(() =>
    (this.topDeals() ?? []).map((deal) => ({
      name: deal.name,
      stage: deal.stage,
      value: this.money.format(deal.value),
    })),
  );

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.widgets.getPipelineBoard();

    if (result.error) {
      this.fail(result.error.message, []);
      return;
    }

    const body = result.data;

    if (body.source === 'sample') {
      this.stages.set(null);
      this.pipelineName.set(null);
      this.topDeals.set(body.topDeals);
      this.sampleData.set(body.sampleData);
      this.warnings.set(body.warnings);
      this.loading.set(false);
      return;
    }

    // A 200 that carries a failure. Nothing above this line treats it as one.
    if (!body.pipeline.ok) {
      this.fail(body.pipeline.message, body.warnings);
      return;
    }

    this.topDeals.set(null);
    this.sampleData.set(null);
    this.pipelineName.set(body.pipeline.pipelineName);
    this.stages.set(body.pipeline.stages);
    this.warnings.set(body.warnings);
    this.loading.set(false);
  }

  /** Clears both views with the error, so no stale board survives behind it. */
  private fail(message: string, warnings: readonly WidgetWarning[]): void {
    this.stages.set(null);
    this.topDeals.set(null);
    this.pipelineName.set(null);
    this.sampleData.set(null);
    this.warnings.set(warnings);
    this.error.set(message);
    this.loading.set(false);
  }
}
