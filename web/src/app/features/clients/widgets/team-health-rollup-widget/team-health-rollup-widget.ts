import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { EmptyState, ErrorState, LoadingState, SampleDataNotice } from '../../../../shared/ui';
import { ClientWidgetsService } from '../../services/client-widgets.service';
import { scoreTone } from '../../services/client-status';
import type { CsmBookSummary, SampleDataDisclosure } from '../../services/client.model';

/**
 * `team_health_rollup` — every CSM on a director's team, worst book first.
 *
 * The ordering deserves a caveat rather than a badge, and the notice carries
 * it. Books are sorted by average health score, and every health score in the
 * system is derived from the same fixed placeholder metrics, so today the
 * ordering is stable but not a ranking: two CSMs with the same number of
 * clients get the same average. It becomes a real ranking the day
 * `mock-metrics.ts` gets a data path, and nothing here changes when it does.
 *
 * Server-side this widget is CSD-only, and the team is keyed on
 * `session.email`. There is no team id to pass and none to forge.
 */
@Component({
  selector: 'app-team-health-rollup-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState, ErrorState, LoadingState, SampleDataNotice],
  templateUrl: './team-health-rollup-widget.html',
  styleUrl: './team-health-rollup-widget.scss',
})
export class TeamHealthRollupWidget {
  private readonly widgets = inject(ClientWidgetsService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly books = signal<readonly CsmBookSummary[]>([]);
  protected readonly sampleData = signal<SampleDataDisclosure | null>(null);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.widgets.getTeamHealthRollup();

    if (result.error) {
      this.books.set([]);
      this.sampleData.set(null);
      this.error.set(result.error.message);
      this.loading.set(false);
      return;
    }

    this.books.set(result.data.books);
    this.sampleData.set(result.data.sampleData);
    this.loading.set(false);
  }

  protected needsAttentionCount(book: CsmBookSummary): number {
    return book.atRisk + book.critical + book.alert;
  }

  protected tone(book: CsmBookSummary): string {
    return scoreTone(book.avgHealthScore);
  }

  protected bookLine(book: CsmBookSummary): string {
    const parts = [
      `${book.clientCount} ${book.clientCount === 1 ? 'client' : 'clients'}`,
      `avg score ${book.avgHealthScore}`,
    ];
    if (book.ascensionReadyCount > 0) {
      parts.push(`${book.ascensionReadyCount} ascension-ready`);
    }
    return parts.join(' · ');
  }

  protected attentionLabel(book: CsmBookSummary): string {
    const count = this.needsAttentionCount(book);
    return count > 0 ? `${count} need attention` : 'All healthy';
  }
}
