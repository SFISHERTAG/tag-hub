import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { EmptyState, ErrorState, LoadingState } from '../../../../../shared/ui';
import { ClientsService } from '../../../services/clients.service';
import type { CampaignWithCreativeCount } from '../../../services/client.model';

/**
 * The client's Meta campaigns, with 24-hour delivery figures.
 *
 * Two things this panel is careful about:
 *
 * - `costPerConversion24h` is labelled "cost per conversion", not ROAS. The
 *   field was called `roas_24h` and computed `spend / conversions`, the inverse
 *   of return on ad spend, so every reading of it ran backwards. The Meta
 *   insights call carries no revenue at all, so a real ROAS cannot be derived
 *   here; `lib/dashboard/roas.ts` computes the genuine article from GHL
 *   opportunity revenue and it lives on the spend widget instead.
 * - Creative counts are requested explicitly, and the response says whether
 *   they were included. When they are not, every count is a placeholder zero
 *   and the badge is not rendered at all — "not counted" must not read as
 *   "none".
 *
 * No ad account configured is a distinct state from no campaigns. The first is
 * a setup gap the CSM can act on; the second means the campaigns have not
 * launched yet.
 */
@Component({
  selector: 'app-campaigns-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState, ErrorState, LoadingState],
  templateUrl: './campaigns-tab.html',
  styleUrl: './campaigns-tab.scss',
})
export class CampaignsTab {
  private readonly clientsApi = inject(ClientsService);

  readonly clientId = input.required<string>();

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly campaigns = signal<readonly CampaignWithCreativeCount[]>([]);
  protected readonly adAccountId = signal<string | null>(null);
  protected readonly creativeCountsIncluded = signal(false);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.clientsApi.getCampaigns(this.clientId(), true);

    if (result.error) {
      this.campaigns.set([]);
      this.adAccountId.set(null);
      this.creativeCountsIncluded.set(false);
      this.error.set(result.error.message);
      this.loading.set(false);
      return;
    }

    this.campaigns.set(result.data.campaigns);
    this.adAccountId.set(result.data.metaAdAccountId);
    this.creativeCountsIncluded.set(result.data.creativeCountsIncluded);
    this.loading.set(false);
  }

  protected money(value: number): string {
    return CURRENCY.format(value);
  }

  protected count(value: number): string {
    return NUMBER.format(value);
  }

  protected created(raw: string): string {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? '-' : new Date(parsed).toLocaleDateString();
  }

  protected creativeLabel(campaign: CampaignWithCreativeCount): string {
    const count = campaign.creative_count;
    return `${count} ${count === 1 ? 'creative' : 'creatives'}`;
  }
}

const CURRENCY = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const NUMBER = new Intl.NumberFormat();
