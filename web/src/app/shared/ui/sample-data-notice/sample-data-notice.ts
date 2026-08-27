import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { SampleDataDisclosure } from './sample-data-notice.model';

/**
 * The visible half of the sample-data contract, and a carried-forward defect
 * that must not regress.
 *
 * Health scores, statuses and escalation buckets are computed from
 * `lib/dashboard/mock-metrics.ts#getMockMetrics`, which returns the same fixed
 * four numbers for every client id. Every score on every screen is therefore
 * identical and is not a reading. Any surface showing one has to say so, out
 * loud, in text — not in a tooltip, not behind a hover, not as a small grey
 * asterisk.
 *
 * Two properties matter:
 *
 * 1. The notice text comes from the server's disclosure, not from a string in
 *    this file. When the Meta integration lands and the server flips
 *    `HEALTH_SCORES_ARE_SAMPLE`, `isSample` goes false and this renders
 *    nothing. There is no second copy of "is this real yet" in the client to
 *    forget to update.
 * 2. It is `role="note"` and it is in the flow of the page. A visually hidden
 *    or collapsed disclosure would satisfy the letter of the requirement and
 *    none of its purpose.
 */
@Component({
  selector: 'app-sample-data-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  templateUrl: './sample-data-notice.html',
  styleUrl: './sample-data-notice.scss',
})
export class SampleDataNotice {
  /** The server's disclosure. Null while loading, or when a payload carries none. */
  readonly disclosure = input<SampleDataDisclosure | null>(null);

  /**
   * `compact` shortens the padding for a widget cell. It does NOT shorten the
   * sentence: the same words appear on a dashboard tile as on a full page,
   * because a tile is exactly where a number gets read without its context.
   */
  readonly compact = input(false);

  protected readonly visible = computed(() => this.disclosure()?.isSample === true);
  protected readonly text = computed(() => this.disclosure()?.notice ?? '');
}
