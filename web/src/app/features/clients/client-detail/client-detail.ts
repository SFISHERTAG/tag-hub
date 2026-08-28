import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import { ErrorState, LoadingState, PageShell, SampleDataNotice } from '../../../shared/ui';
import { ClientsService } from '../services/clients.service';
import { HealthBadge } from '../shared/health-badge/health-badge';
import { OverviewTab } from './tabs/overview-tab/overview-tab';
import { CampaignsTab } from './tabs/campaigns-tab/campaigns-tab';
import { CreativesTab } from './tabs/creatives-tab/creatives-tab';
import { Phase3Tab } from './tabs/phase3-tab/phase3-tab';
import type { ClientData, SampleDataDisclosure } from '../services/client.model';

/**
 * One client, in depth: health, alerts, campaigns, creatives, Meta setup.
 *
 * A route, not a modal. The reference implementation rendered this as a fixed
 * overlay driven by component state, so the detail had no URL — it could not be
 * linked to from an alert, opened in a new tab, or survive a reload, and the
 * browser's back button closed the whole book instead of the panel. None of
 * that was a deliberate trade; it is just what a modal costs.
 *
 * Each tab fetches its own data through `matTabContent`, so opening the page
 * does not fire four requests for three panels nobody looked at. A tab that
 * fails shows its own error and leaves the rest of the page working.
 */
@Component({
  selector: 'app-client-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    PageShell,
    ErrorState,
    LoadingState,
    HealthBadge,
    SampleDataNotice,
    OverviewTab,
    CampaignsTab,
    CreativesTab,
    Phase3Tab,
  ],
  templateUrl: './client-detail.html',
  styleUrl: './client-detail.scss',
})
export class ClientDetail {
  private readonly clientsApi = inject(ClientsService);

  /** Bound from the route parameter via `withComponentInputBinding()`. */
  readonly clientId = input.required<string>();

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly client = signal<ClientData | null>(null);
  protected readonly sampleData = signal<SampleDataDisclosure | null>(null);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.clientsApi.getClient(this.clientId());

    if (result.error) {
      this.client.set(null);
      this.sampleData.set(null);
      this.error.set(result.error.message);
      this.loading.set(false);
      return;
    }

    this.client.set(result.data.client);
    this.sampleData.set(result.data.sampleData);
    this.loading.set(false);
  }
}
