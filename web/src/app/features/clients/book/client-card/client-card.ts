import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { HealthBadge } from '../../shared/health-badge/health-badge';
import type { ClientData } from '../../services/client.model';

/**
 * One client, as a card. Shared by the grid and kanban views.
 *
 * The name is a real anchor, not a card-wide `(click)`. The reference
 * implementation made the whole card a `<button>` that opened a modal, which
 * meant the client detail had no URL, could not be opened in a new tab, could
 * not be linked to from an alert, and lost its place on reload. A route costs
 * nothing here and gives all of that back.
 *
 * Metrics render as percentages against target, which is what they are:
 * `HealthMetrics.roas` is "percent of ROAS target achieved", not a ROAS
 * multiple. The reference implementation printed the same field as both,
 * `{roas.toFixed(0)}%` on the card and `{roas.toFixed(2)}x` in the detail
 * modal, so the same 95 read as "95% of target" in one place and "95x return"
 * in the other. Only one of those can be true; the field's own comment in
 * `health-scoring.ts` says it is the percentage.
 */
@Component({
  selector: 'app-client-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatCardModule, HealthBadge],
  templateUrl: './client-card.html',
  styleUrl: './client-card.scss',
})
export class ClientCard {
  readonly client = input.required<ClientData>();
  /** Route prefix, so the card does not hardcode where the book lives. */
  readonly detailLinkBase = input<readonly string[]>(['/clients']);

  protected readonly link = computed(() => [...this.detailLinkBase(), this.client().id]);

  protected readonly metrics = computed(() => {
    const metrics = this.client().metrics;
    if (!metrics) return null;
    return [
      { label: 'ROAS target', value: `${Math.round(metrics.roas)}%` },
      { label: 'Budget', value: `${Math.round(metrics.spend)}%` },
      { label: 'Leads target', value: `${Math.round(metrics.leads)}%` },
      { label: 'SLA', value: `${Math.round(metrics.sla)}%` },
    ];
  });

  protected readonly alertLabel = computed(() => {
    const count = this.client().alert_count;
    return `${count} open ${count === 1 ? 'alert' : 'alerts'}`;
  });
}
