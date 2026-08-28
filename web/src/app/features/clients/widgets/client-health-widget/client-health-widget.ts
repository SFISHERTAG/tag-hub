import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyState, ErrorState, LoadingState, SampleDataNotice } from '../../../../shared/ui';
import { ClientWidgetsService } from '../../services/client-widgets.service';
import { needsAttention } from '../../services/client-status';
import { HealthBadge } from '../../shared/health-badge/health-badge';
import type { ClientData, SampleDataDisclosure } from '../../services/client.model';

const VISIBLE = 8;

/**
 * `client_health` — the same book as the portfolio widget, filtered to the
 * clients that need eyes on them, worst score first.
 *
 * The filter runs here rather than server-side because the endpoint is shared
 * with the portfolio widget, and "needs attention" is a display decision: the
 * three statuses it covers come from `client-status.ts`, so this widget and the
 * book's counts cannot disagree about which they are.
 *
 * The sample-data notice is not optional decoration on this one. Every health
 * score in the list is computed from the same four fixed numbers, so "these
 * three clients need attention" is currently a statement about the code, not
 * about the clients.
 */
@Component({
  selector: 'app-client-health-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EmptyState, ErrorState, LoadingState, HealthBadge, SampleDataNotice],
  templateUrl: './client-health-widget.html',
  styleUrl: './client-health-widget.scss',
})
export class ClientHealthWidget {
  private readonly widgets = inject(ClientWidgetsService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly clients = signal<readonly ClientData[]>([]);
  protected readonly sampleData = signal<SampleDataDisclosure | null>(null);

  protected readonly flagged = computed(() =>
    this.clients()
      .filter((client) => needsAttention(client.health.status))
      .sort((a, b) => a.health.score - b.health.score),
  );

  protected readonly visible = computed(() => this.flagged().slice(0, VISIBLE));

  protected readonly overflow = computed(() => Math.max(0, this.flagged().length - VISIBLE));

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.widgets.getClientHealth();

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
