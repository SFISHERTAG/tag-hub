import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyState, ErrorState, LoadingState, SampleDataNotice } from '../../../../shared/ui';
import { ClientWidgetsService } from '../../services/client-widgets.service';
import { HealthBadge } from '../../shared/health-badge/health-badge';
import type { ClientData, SampleDataDisclosure } from '../../services/client.model';

const VISIBLE = 8;

/**
 * `portfolio` — every client in the caller's book, at a glance.
 *
 * Self-fetching. The dashboard shell resolves this by id through the widget
 * registry and hands it nothing, which is what lets the shell stay ignorant of
 * what a client is. The endpoint derives the book from the session's role, so
 * there is no scope for the shell to pass and no id for a caller to substitute.
 *
 * `GET /api/dashboard/widgets/portfolio` re-checks `availableFor` before it
 * touches data, so a 403 here is the entitlement boundary working, not a bug —
 * it is what happens when a saved layout outlives the role that could use it.
 */
@Component({
  selector: 'app-portfolio-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EmptyState, ErrorState, LoadingState, HealthBadge, SampleDataNotice],
  templateUrl: './portfolio-widget.html',
  styleUrl: './portfolio-widget.scss',
})
export class PortfolioWidget {
  private readonly widgets = inject(ClientWidgetsService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly clients = signal<readonly ClientData[]>([]);
  protected readonly sampleData = signal<SampleDataDisclosure | null>(null);

  protected readonly visible = computed(() => this.clients().slice(0, VISIBLE));

  protected readonly overflow = computed(() => Math.max(0, this.clients().length - VISIBLE));

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.widgets.getPortfolio();

    if (result.error) {
      this.clients.set([]);
      this.sampleData.set(null);
      this.error.set(result.error.message);
      this.loading.set(false);
      return;
    }

    this.clients.set(result.data.clients);
    this.sampleData.set(result.data.sampleData);
    this.loading.set(false);
  }
}
