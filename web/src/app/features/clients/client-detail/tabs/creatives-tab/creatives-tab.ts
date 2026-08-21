import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { EmptyState, ErrorState, LoadingState } from '../../../../../shared/ui';
import { ClientsService } from '../../../services/clients.service';
import type { CreativeWithCampaigns } from '../../../services/client.model';

type CreativeStatus = CreativeWithCampaigns['status'];

interface CreativeGroup {
  readonly status: CreativeStatus;
  readonly label: string;
  readonly creatives: readonly CreativeWithCampaigns[];
}

const GROUPS: readonly { status: CreativeStatus; label: string }[] = [
  { status: 'pending-approval', label: 'Pending approval' },
  { status: 'rejected', label: 'Rejected' },
  { status: 'draft', label: 'Draft' },
  { status: 'approved', label: 'Approved' },
];

const FORMAT_ICON: Record<CreativeWithCampaigns['format'], string> = {
  video: 'movie',
  image: 'image',
  carousel: 'view_carousel',
  text: 'notes',
  document: 'description',
};

/**
 * The client's creatives, grouped by approval state, worth-acting-on first.
 *
 * Two deliberate differences from the reference implementation:
 *
 * - The "Upload New Creative / Browse Files" panel is gone. It was a styled
 *   button with no handler: it looked like the way to add a creative and did
 *   nothing when clicked. A missing affordance is a smaller problem than one
 *   that lies.
 * - When the campaign-link lookup fails the endpoint says so
 *   (`campaignLinksIncluded: false`) and this panel says so too. Otherwise
 *   every creative renders as "used in no campaigns", which is a claim, not the
 *   absence of one. That writer is `syncCreativeToCampaignMappings`, which has
 *   no call site anywhere — so empty links are expected today and the reader
 *   deserves to know why.
 */
@Component({
  selector: 'app-creatives-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, EmptyState, ErrorState, LoadingState],
  templateUrl: './creatives-tab.html',
  styleUrl: './creatives-tab.scss',
})
export class CreativesTab {
  private readonly clientsApi = inject(ClientsService);

  readonly clientId = input.required<string>();

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly creatives = signal<readonly CreativeWithCampaigns[]>([]);
  protected readonly locationId = signal<string | null>(null);
  protected readonly campaignLinksIncluded = signal(true);

  protected readonly groups = computed<readonly CreativeGroup[]>(() => {
    const creatives = this.creatives();
    return GROUPS.map((group) => ({
      ...group,
      creatives: creatives.filter((creative) => creative.status === group.status),
    })).filter((group) => group.creatives.length > 0);
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.clientsApi.getCreatives(this.clientId());

    if (result.error) {
      this.creatives.set([]);
      this.locationId.set(null);
      this.campaignLinksIncluded.set(true);
      this.error.set(result.error.message);
      this.loading.set(false);
      return;
    }

    this.creatives.set(result.data.creatives);
    this.locationId.set(result.data.locationId);
    this.campaignLinksIncluded.set(result.data.campaignLinksIncluded);
    this.loading.set(false);
  }

  protected icon(creative: CreativeWithCampaigns): string {
    return FORMAT_ICON[creative.format];
  }

  protected submitted(raw: string): string {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? '-' : new Date(parsed).toLocaleDateString();
  }

  protected campaignNames(creative: CreativeWithCampaigns): string {
    return creative.campaigns_using.map((campaign) => campaign.campaignName).join(', ');
  }
}
