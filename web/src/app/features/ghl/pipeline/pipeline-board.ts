import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, convertToParamMap } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { EmptyState, ErrorState, LoadingState, PageShell } from '../../../shared/ui';
import { DealCard } from './deal-card';
import { PipelineService } from '../services/pipeline.service';
import { classifyGhlError, type GhlFailure } from '../services/ghl-error';
import { formatMoney, plural } from '../services/ghl-format';
import { injectLocationId } from '../services/location-id';
import {
  PIPELINE_STATUS_FILTERS,
  isPipelineStatusFilter,
  type PipelineBoard as Board,
  type PipelineStage,
  type PipelineStatusFilter,
} from '../services/ghl.model';

const EMPTY_STAGES: readonly PipelineStage[] = [];

/**
 * The kanban board: every pipeline for one client, bucketed into its stages.
 *
 * The status filter lives in the URL (`?status=won`) rather than in a signal,
 * exactly as the legacy board had it. That is deliberate — a filtered board is
 * the thing people paste into Slack, and a filter held only in memory produces
 * a link that shows the recipient something else.
 *
 * Two behaviours worth naming. First, the columns come from the endpoint
 * already grouped: `groupByStage` and the 14-day staleness rule are server-side
 * and nothing here re-derives them, so the board and any other reader of the
 * same data cannot disagree about which column a deal is in. Second, `unstaged`
 * is rendered. The legacy board iterated stages and read a group map, so an
 * opportunity whose stage id was not in its own pipeline simply vanished from
 * the screen with no count anywhere to notice it by.
 */
@Component({
  selector: 'app-pipeline-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatButtonModule,
    PageShell,
    EmptyState,
    ErrorState,
    LoadingState,
    DealCard,
  ],
  templateUrl: './pipeline-board.html',
  styleUrl: './pipeline-board.scss',
})
export class PipelineBoard {
  private readonly pipeline = inject(PipelineService);
  private readonly route = inject(ActivatedRoute);

  protected readonly locationId = injectLocationId();
  protected readonly statuses = PIPELINE_STATUS_FILTERS;

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: convertToParamMap({}),
  });

  protected readonly status = computed<PipelineStatusFilter>(() => {
    const requested = this.queryParams().get('status');
    // An unrecognised value falls back rather than 400s: a hand-edited URL
    // should show the default board, not an error the reader cannot act on.
    return isPipelineStatusFilter(requested) ? requested : 'open';
  });

  protected readonly loading = signal(true);
  protected readonly failure = signal<GhlFailure | null>(null);
  protected readonly boards = signal<readonly Board[]>([]);

  /**
   * Guards against out-of-order responses. Clicking through three filters
   * quickly leaves three requests in flight, and the slowest one must not be
   * the one that paints — a board labelled "won" showing open deals is a
   * failure nobody would think to question.
   */
  private request = 0;

  private readonly stagesByPipeline = computed(
    () =>
      new Map<string, readonly PipelineStage[]>(
        this.boards().map((board) => [
          board.pipeline.id,
          board.columns.map((column) => column.stage),
        ]),
      ),
  );

  protected readonly totalCount = computed(() =>
    this.boards().reduce((total, board) => total + board.count, 0),
  );

  protected readonly subtitle = computed(() => {
    if (this.loading() || this.failure() !== null) return null;
    const value = this.boards().reduce((total, board) => total + board.value, 0);
    const deals = plural(this.totalCount(), 'deal');
    return value > 0 ? `${deals} · ${formatMoney(value)}` : deals;
  });

  constructor() {
    effect(() => {
      const locationId = this.locationId();
      const status = this.status();
      void this.load(locationId, status);
    });
  }

  protected reload(): void {
    void this.load(this.locationId(), this.status());
  }

  protected stagesFor(pipelineId: string): readonly PipelineStage[] {
    return this.stagesByPipeline().get(pipelineId) ?? EMPTY_STAGES;
  }

  protected money(value: number): string {
    return formatMoney(value);
  }

  protected dealsLabel(count: number): string {
    return plural(count, 'deal');
  }

  protected statusLabel(status: PipelineStatusFilter): string {
    return status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1);
  }

  private async load(locationId: string, status: PipelineStatusFilter): Promise<void> {
    const token = ++this.request;

    if (locationId === '') {
      // Unreachable through the router — `l/:locationId` cannot match without
      // one — so this is a wiring fault, and it says so rather than asking the
      // API for `/locations//pipeline` and rendering GHL's confusion.
      this.loading.set(false);
      this.boards.set([]);
      this.failure.set({
        kind: 'missing',
        title: 'No client selected',
        detail: 'Open this board from a client in your portfolio.',
        retryable: false,
      });
      return;
    }

    this.loading.set(true);
    this.failure.set(null);

    const result = await this.pipeline.board(locationId, status);
    if (token !== this.request) return;

    this.loading.set(false);

    if (result.error) {
      // Cleared, never left behind an error: a board rendered under a failure
      // notice is a board someone will act on.
      this.boards.set([]);
      this.failure.set(classifyGhlError(result.error));
      return;
    }

    this.boards.set(result.data.boards);
  }
}
