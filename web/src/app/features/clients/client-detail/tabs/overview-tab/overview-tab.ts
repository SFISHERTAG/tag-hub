import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { EmptyState, ErrorState, HudGauge, LoadingState } from '../../../../../shared/ui';
import { ClientsService } from '../../../services/clients.service';
import type { ClientAlert, ClientData } from '../../../services/client.model';

interface ScoreRow {
  readonly label: string;
  readonly score: number;
  readonly attainment: string;
}

/**
 * Health components and open alerts.
 *
 * The four component scores and the four metrics they came from are shown side
 * by side on purpose. The reference implementation printed the metric as `95%`
 * on the card and `95.00x` in this panel — the same field rendered once as a
 * percentage of target and once as a ROAS multiple. `HealthMetrics` documents
 * itself as "target achievement %", so there is one reading of it here and it
 * is the documented one.
 *
 * The four components are dials rather than figures because each is a 0-100
 * score against its own target, which is what a dial reads well: the arc is
 * proportion-of-target and needs no axis to be understood. Counts get no dial
 * anywhere in this app — a count has no full scale, so any max is invented and
 * the arc becomes decoration that implies a ceiling nobody set.
 *
 * Worth stating plainly: these four numbers are currently fabricated, and a
 * dial reads as more authoritative than the bare figure it replaced. The
 * disclosure that makes that safe is `SampleDataNotice` in client-detail.html,
 * directly above this tab group. If that notice is ever moved or made
 * conditional, these dials become the most confident lie on the screen.
 *
 * Resolved alerts are filtered out rather than shown greyed: the count in the
 * heading is the number of things to do, and a resolved alert is not one.
 */
@Component({
  selector: 'app-overview-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState, ErrorState, HudGauge, LoadingState],
  templateUrl: './overview-tab.html',
  styleUrl: './overview-tab.scss',
})
export class OverviewTab {
  private readonly clientsApi = inject(ClientsService);

  readonly client = input.required<ClientData>();

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly alerts = signal<readonly ClientAlert[]>([]);

  protected readonly activeAlerts = computed(() =>
    this.alerts().filter((alert) => alert.resolved_at === undefined),
  );

  protected readonly alertsHeading = computed(() => {
    const count = this.activeAlerts().length;
    return `Open alerts (${count})`;
  });

  protected readonly scores = computed<readonly ScoreRow[]>(() => {
    const { health, metrics } = this.client();
    return [
      { label: 'ROAS', score: health.roas_score, attainment: attainment(metrics?.roas) },
      { label: 'Budget', score: health.spend_score, attainment: attainment(metrics?.spend) },
      { label: 'Leads', score: health.leads_score, attainment: attainment(metrics?.leads) },
      { label: 'SLA', score: health.sla_score, attainment: attainment(metrics?.sla) },
    ];
  });

  protected readonly lastUpdated = computed(() => {
    const raw = this.client().health.last_updated;
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? null : new Date(parsed).toLocaleString();
  });

  /**
   * Keyed on the client id, and an effect rather than a constructor call.
   *
   * `void this.load()` in the constructor read `client()` synchronously, before
   * Angular had bound the input. That threw NG0950 inside an async function, so
   * the rejection went to `void` and vanished: `getAlerts` was never called,
   * `loading` was never cleared, and the alerts panel showed its skeleton
   * forever. It looked like a slow request rather than a dead one, which is why
   * it survived — proven by a template-binding test that counted zero calls.
   *
   * Reading the id inside the effect also makes this reload when the tab is
   * pointed at a different client, which the constructor version could not do:
   * the tab is reused across clients rather than recreated, so the previous
   * client's alerts would have stayed on screen.
   */
  constructor() {
    effect(() => {
      void this.load(this.client().id);
    });
  }

  /** Defaults to the current client so the template's retry button stays argument-free. */
  protected async load(clientId: string = this.client().id): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.clientsApi.getAlerts(clientId);

    if (result.error) {
      this.alerts.set([]);
      this.error.set(result.error.message);
      this.loading.set(false);
      return;
    }

    this.alerts.set(result.data.alerts);
    this.loading.set(false);
  }
}

/**
 * "-" when there is no metric, never "0%". `metrics` is optional on ClientData,
 * and reporting an unmeasured client as 0% of target is a far stronger claim
 * than reporting that we have no figure.
 */
function attainment(value: number | undefined): string {
  return value === undefined ? '-' : `${Math.round(value)}% of target`;
}
