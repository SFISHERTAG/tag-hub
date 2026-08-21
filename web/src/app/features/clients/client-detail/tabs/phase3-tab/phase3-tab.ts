import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { EmptyState, ErrorState, LoadingState } from '../../../../../shared/ui';
import { ClientsService } from '../../../services/clients.service';
import type { Phase3Progress, Phase3Status } from '../../../services/client.model';

interface StatusMeta {
  readonly label: string;
  readonly tone: 'positive' | 'caution' | 'negative';
  /** What is being waited on, or null when nothing is. */
  readonly waitingOn: string | null;
}

const STATUS_META: Record<Phase3Status, StatusMeta> = {
  pending: { label: 'Pending', tone: 'caution', waitingOn: null },
  in_progress: { label: 'In progress', tone: 'caution', waitingOn: null },
  meta_access_requested: {
    label: 'Access requested',
    tone: 'caution',
    waitingOn:
      'Access request sent. Waiting for the client to grant system user permissions in Meta Ads Manager.',
  },
  setup_guide_sent: {
    label: 'Setup guide sent',
    tone: 'caution',
    waitingOn:
      'Setup guide sent. Waiting for the client to create a Meta ad account and reply with the account id.',
  },
  complete: { label: 'Complete', tone: 'positive', waitingOn: null },
  error: { label: 'Error', tone: 'negative', waitingOn: null },
};

/**
 * Phase 3: getting the client's Meta ad account connected.
 *
 * This panel reports a real behaviour change and it is worth knowing about.
 * The reference implementation passed `client.id` to `getPhase3Status`, which
 * queries the automation log by `location_id`. The two never matched, so the
 * lookup always missed and every client rendered "Phase 3 not yet started"
 * regardless of actual progress. The endpoint now passes the client's
 * `ghl_location_id`. A client that suddenly shows real progress here is not new
 * data; it is the first time this panel has been able to see it.
 */
@Component({
  selector: 'app-phase3-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState, ErrorState, LoadingState],
  templateUrl: './phase3-tab.html',
  styleUrl: './phase3-tab.scss',
})
export class Phase3Tab {
  private readonly clientsApi = inject(ClientsService);

  readonly clientId = input.required<string>();

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly phase3 = signal<Phase3Progress | null>(null);
  protected readonly locationId = signal<string | null>(null);

  protected readonly meta = computed<StatusMeta | null>(() => {
    const phase3 = this.phase3();
    return phase3 ? STATUS_META[phase3.status] : null;
  });

  protected readonly accountLine = computed(() => {
    const phase3 = this.phase3();
    if (!phase3 || phase3.hasMetaAccount === undefined) {
      return 'Whether the client already has a Meta ad account is not recorded.';
    }
    return phase3.hasMetaAccount
      ? 'Client has an existing Meta ad account.'
      : 'Client is creating a new Meta ad account.';
  });

  protected readonly lastUpdate = computed(() => {
    const raw = this.phase3()?.lastEventTime;
    if (raw === undefined) return null;
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? null : new Date(parsed).toLocaleString();
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.clientsApi.getPhase3(this.clientId());

    if (result.error) {
      this.phase3.set(null);
      this.locationId.set(null);
      this.error.set(result.error.message);
      this.loading.set(false);
      return;
    }

    this.phase3.set(result.data.phase3);
    this.locationId.set(result.data.locationId);
    this.loading.set(false);
  }
}
