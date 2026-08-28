import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ErrorState, LoadingState, SampleDataNotice } from '../../../../shared/ui';
import { GhlWidgetsService } from '../../services/ghl-widgets.service';
import type {
  FunnelStage,
  SampleDataDisclosure,
  WidgetWarning,
} from '../../services/ghl-widgets.model';

/**
 * `leads_funnel` — lead, booked, showed, closed over the window.
 *
 * ## Why there is no dial on this tile
 *
 * The precedent is `clients/widgets/department-overview-widget.ts`, which puts
 * a 0-100 health score on an arc and deliberately leaves its counts as figures:
 * a count has no full scale, so drawing one on a gauge means inventing a
 * maximum, and the arc then implies a ceiling nobody set. Every figure on this
 * widget is a count. So every figure here is a figure, and the tile carries no
 * gauge at all.
 *
 * The tempting alternative is to draw each stage as a proportion of `Leads`,
 * which is a real denominator rather than an invented one. It is still wrong
 * here, for a reason specific to this endpoint: the server returns
 * `showRateDenominator` precisely because the raw `Booked` count includes
 * pre-call DQs and is NOT the right denominator for the Showed stage. A
 * stage-over-stage percentage computed in this component would silently
 * disagree with the server's own show-rate arithmetic. If this tile ever shows
 * a rate, it shows the server's, not one of its own.
 *
 * ## Three ways this can be not-a-reading, all of which must be visible
 *
 * 1. **Transport failure.** `ApiResult.error` — the ordinary case.
 * 2. **`funnel.ok === false` inside an HTTP 200.** GHL failed but the route
 *    still answered successfully. `ApiResult.error` is null here, so a consumer
 *    that only checks the transport renders an empty or zeroed funnel and calls
 *    it a reading. This is the "revoked token renders as $0 spend" pattern
 *    CLAUDE.md's error contract names, and it is handled as an error state, not
 *    as zeroes.
 * 3. **Present but qualified.** `truncated` (the contact fetch hit its page
 *    cap, so every count is an undercount) and `no_location` (no GHL location,
 *    so the numbers are sample) arrive as `warnings` alongside real-looking
 *    data. They render in the flow of the tile, not behind a tooltip, for the
 *    same reason `SampleDataNotice` does: a dashboard tile is exactly where a
 *    number gets read without its context.
 *
 * Zero is shown as zero, and that is deliberate: a funnel whose stages are
 * genuinely empty is a real reading of a real window. All three states above
 * take a different branch, so a zero here never stands in for a missing number.
 */
@Component({
  selector: 'app-leads-funnel-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErrorState, LoadingState, SampleDataNotice],
  templateUrl: './leads-funnel-widget.html',
  styleUrl: './leads-funnel-widget.scss',
})
export class LeadsFunnelWidget {
  private readonly widgets = inject(GhlWidgetsService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly stages = signal<readonly FunnelStage[] | null>(null);
  protected readonly warnings = signal<readonly WidgetWarning[]>([]);
  protected readonly sampleData = signal<SampleDataDisclosure | null>(null);
  protected readonly days = signal<number | null>(null);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.widgets.getLeadsFunnel();

    if (result.error) {
      this.fail(result.error.message);
      return;
    }

    const body = result.data;
    this.days.set(body.days);

    if (body.source === 'sample') {
      this.stages.set(body.stages);
      this.sampleData.set(body.sampleData);
      this.warnings.set(body.warnings);
      this.loading.set(false);
      return;
    }

    // A 200 that carries a failure. Nothing above this line treats it as one.
    if (!body.funnel.ok) {
      this.fail(body.funnel.message);
      return;
    }

    this.stages.set(body.funnel.stages);
    this.sampleData.set(null);
    this.warnings.set(body.warnings);
    this.loading.set(false);
  }

  /** Clears the data with the error, so no stale funnel survives behind it. */
  private fail(message: string): void {
    this.stages.set(null);
    this.sampleData.set(null);
    this.warnings.set([]);
    this.error.set(message);
    this.loading.set(false);
  }
}
