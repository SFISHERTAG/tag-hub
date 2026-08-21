import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageShell } from '../../../shared/ui';
import { FollowUpPanel } from './follow-up-panel';
import { injectLocationId } from '../services/location-id';

/**
 * The dedicated follow-up screen. Ports `legacy/followup/page.tsx`.
 *
 * Two defects of that page are gone, and neither was fixed here: both were
 * fixed in the endpoint, which is the only place they could be fixed once. The
 * legacy page resolved the queue with a 90-day lookback while `/today` used 30,
 * so the two screens disagreed about whether the same contact had rebooked. And
 * it dropped any candidate whose appointment fell outside the fetch window
 * entirely (`if (!appointment?.contactId) return null`), deleting rows rather
 * than degrading them.
 *
 * The screen itself is thin on purpose: one shared panel, asked for the
 * enriched view. Anything it computed locally would be the third opinion about
 * the same queue.
 */
@Component({
  selector: 'app-follow-up-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageShell, FollowUpPanel],
  templateUrl: './follow-up-page.html',
  styleUrl: './follow-up-page.scss',
})
export class FollowUpPage {
  protected readonly locationId = injectLocationId();
}
