import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ErrorState, LoadingState } from '../../../../shared/ui';
import { ClientWidgetsService } from '../../services/client-widgets.service';
import { scoreTone } from '../../services/client-status';
import { SampleDataNotice } from '../../shared/sample-data-notice/sample-data-notice';
import type { DepartmentSummary, SampleDataDisclosure } from '../../services/client.model';

interface Tile {
  readonly label: string;
  readonly value: number;
  readonly tone: 'positive' | 'caution' | 'negative' | 'neutral';
}

const TOP_BOOKS = 5;

/**
 * `department_overview` — the exec view: department totals, then which books
 * need eyes first.
 *
 * Zero is shown as zero here, unlike an empty list, and that is deliberate:
 * "0 clients need attention" is a real reading of a real department, not a
 * placeholder standing in for a missing one. The distinction the empty-state
 * rule protects is between "no data" and "data that says none", and a failed
 * load takes the error branch rather than rendering zeroes.
 */
@Component({
  selector: 'app-department-overview-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErrorState, LoadingState, SampleDataNotice],
  templateUrl: './department-overview-widget.html',
  styleUrl: './department-overview-widget.scss',
})
export class DepartmentOverviewWidget {
  private readonly widgets = inject(ClientWidgetsService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly summary = signal<DepartmentSummary | null>(null);
  protected readonly sampleData = signal<SampleDataDisclosure | null>(null);

  protected readonly tiles = computed<readonly Tile[]>(() => {
    const summary = this.summary();
    if (!summary) return [];
    return [
      { label: 'Total clients', value: summary.totalClients, tone: 'neutral' },
      {
        label: 'Avg health score',
        value: summary.avgHealthScore,
        tone: scoreTone(summary.avgHealthScore),
      },
      {
        label: 'Need attention',
        value: summary.needsAttentionCount,
        tone: summary.needsAttentionCount > 0 ? 'negative' : 'positive',
      },
      {
        label: 'Ascension ready',
        value: summary.ascensionReadyCount,
        tone: summary.ascensionReadyCount > 0 ? 'positive' : 'neutral',
      },
    ];
  });

  protected readonly topBooks = computed(
    () => this.summary()?.booksByRisk.slice(0, TOP_BOOKS) ?? [],
  );

  protected readonly csmLabel = computed(() => {
    const count = this.summary()?.csmCount ?? 0;
    return `${count} ${count === 1 ? 'CSM' : 'CSMs'}`;
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.widgets.getDepartmentOverview();

    if (result.error) {
      this.summary.set(null);
      this.sampleData.set(null);
      this.error.set(result.error.message);
      this.loading.set(false);
      return;
    }

    this.summary.set(result.data.summary);
    this.sampleData.set(result.data.sampleData);
    this.loading.set(false);
  }
}
