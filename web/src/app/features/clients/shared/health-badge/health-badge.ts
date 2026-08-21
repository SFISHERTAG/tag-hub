import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { statusDisplay } from '../../services/client-status';
import type { ClientHealth } from '../../services/client.model';

/**
 * A health score with its status, and its sample marker attached.
 *
 * This component exists because of the second half of the sample-data defect.
 * A page-level notice covers the page; it does not travel with a badge that
 * gets lifted out of a list into a card, a table cell, or a detail header. The
 * server marks each health record individually with `is_sample` for exactly
 * that reason, and this is the component that honours it — every badge carries
 * its own "sample" chip, wherever it lands.
 *
 * The tone is a semantic name, resolved to an M3 token in the stylesheet. No
 * colour is decided here.
 */
@Component({
  selector: 'app-health-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './health-badge.html',
  styleUrl: './health-badge.scss',
})
export class HealthBadge {
  readonly health = input.required<ClientHealth>();
  /** Hides the numeric score, for places that show it separately. */
  readonly showScore = input(true);

  protected readonly display = computed(() => statusDisplay(this.health().status));

  /**
   * One string for assistive tech instead of three adjacent fragments, so a
   * screen reader announces "Health: at risk, score 62, sample data" rather
   * than reading a badge, a number and a chip as unrelated items.
   */
  protected readonly label = computed(() => {
    const health = this.health();
    const parts = [`Health: ${this.display().label}`];
    if (this.showScore()) parts.push(`score ${health.score}`);
    if (health.is_sample) parts.push('sample data, not a reading');
    return parts.join(', ');
  });
}
