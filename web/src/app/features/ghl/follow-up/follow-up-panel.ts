import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { EmptyState, ErrorState, LoadingState } from '../../../shared/ui';
import { FOLLOW_UP_MAX_THRESHOLD, FollowUpService } from '../services/follow-up.service';
import { classifyGhlError, type GhlFailure } from '../services/ghl-error';
import { formatTime, plural, relativeDays } from '../services/ghl-format';
import {
  isFollowUpMode,
  type FollowUpEntry,
  type FollowUpResponse,
  type FollowUpThresholdMode,
} from '../services/ghl.model';

/**
 * Contacts who no-showed or DQ'd with nothing newer on the books.
 *
 * ONE component for both screens, because there is one queue. The today view
 * embeds it with `enrich=false` (Story 2.8 AC5: no per-row fetch while the day
 * is rendering) and the dedicated follow-up screen embeds it with
 * `enrich=true`, which adds the contact and the deal at two GHL calls a row.
 * Membership is identical either way: `resolveFollowUpQueue` decides it
 * server-side, and that is the function which excludes CANCELLED appointments
 * when asking whether a contact rebooked. A cancelled replacement booking is
 * not a rebooking — treating it as one is what used to delete precisely the
 * lead this queue exists to surface — and nothing on this side re-decides it.
 *
 * The threshold editor is shown on the server's `canConfigure` flag rather than
 * a role list copied into the client. The endpoint owns that rule (closing
 * manager or owner) and re-checks it on the PUT regardless; a duplicate list
 * here would be a second opinion with no way to notice when it drifted.
 */
@Component({
  selector: 'app-follow-up-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    EmptyState,
    ErrorState,
    LoadingState,
  ],
  templateUrl: './follow-up-panel.html',
  styleUrl: './follow-up-panel.scss',
})
export class FollowUpPanel {
  private readonly followUp = inject(FollowUpService);

  readonly locationId = input.required<string>();
  /** Adds contact and deal per row. Two GHL calls a row — never on the day view. */
  readonly enrich = input(false);
  readonly heading = input('Needs follow-up');

  protected readonly loading = signal(true);
  protected readonly failure = signal<GhlFailure | null>(null);
  protected readonly data = signal<FollowUpResponse | null>(null);

  protected readonly maxThreshold = FOLLOW_UP_MAX_THRESHOLD;

  /** Re-seeded from every response, so a reload wins over a half-typed edit
   * rather than silently keeping a value the server never stored. */
  protected readonly mode = linkedSignal<FollowUpThresholdMode>(
    () => this.data()?.config.mode ?? 'days',
  );
  protected readonly threshold = linkedSignal(() => {
    const value = this.data()?.config.value;
    return value === undefined ? '' : String(value);
  });

  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly saved = signal(false);

  protected readonly candidates = computed<readonly FollowUpEntry[]>(
    () => this.data()?.candidates ?? [],
  );

  protected readonly countLabel = computed(() =>
    plural(this.data()?.total ?? 0, 'contact'),
  );

  protected readonly truncatedLabel = computed(() => {
    const data = this.data();
    if (data === null || !data.truncated) return null;
    return `Showing ${data.candidates.length} of ${data.total}. Work these first, then reload.`;
  });

  private request = 0;

  constructor() {
    effect(() => {
      const locationId = this.locationId();
      const enrich = this.enrich();
      void this.load(locationId, enrich);
    });
  }

  protected reload(): void {
    void this.load(this.locationId(), this.enrich());
  }

  protected onModeChange(next: unknown): void {
    if (isFollowUpMode(next)) this.mode.set(next);
    this.saved.set(false);
    this.saveError.set(null);
  }

  protected setThreshold(next: unknown): void {
    this.threshold.set(next === null || next === undefined ? '' : String(next));
    this.saved.set(false);
    this.saveError.set(null);
  }

  protected statusLabel(entry: FollowUpEntry): string {
    return entry.status === 'noshow' ? 'No-show' : 'DQ';
  }

  /** The enriched name when there is one, and the denormalized name otherwise.
   * The outcome record carries a name precisely so a row without an enrichment
   * still says who it is. */
  protected nameOf(entry: FollowUpEntry): string {
    return entry.contact?.displayName ?? entry.contactName;
  }

  protected appointmentLabel(entry: FollowUpEntry): string {
    const title = entry.appointment?.title ?? entry.appointmentTitle;
    const start = entry.appointment?.startTime;
    return start === undefined ? title : `${formatTime(start)} · ${title}`;
  }

  protected attemptsLabel(entry: FollowUpEntry): string {
    return plural(entry.attempts, 'attempt');
  }

  protected markedLabel(entry: FollowUpEntry): string {
    return relativeDays(entry.markedAt);
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;

    this.saveError.set(null);
    this.saved.set(false);

    const value = Number(this.threshold().trim());
    // Stricter than the endpoint, which accepts any positive finite number.
    // Both modes count whole things — days, attempts — so half of one is a
    // typo, and catching it here saves a round trip to be told so.
    if (!Number.isInteger(value) || value <= 0 || value > FOLLOW_UP_MAX_THRESHOLD) {
      this.saveError.set(`Enter a whole number from 1 to ${FOLLOW_UP_MAX_THRESHOLD}.`);
      return;
    }

    this.saving.set(true);
    const result = await this.followUp.saveConfig(this.locationId(), {
      mode: this.mode(),
      value,
    });
    this.saving.set(false);

    if (result.error) {
      this.saveError.set(classifyGhlError(result.error).detail);
      return;
    }

    this.saved.set(true);
    // The threshold decides who ages out, so the queue this panel is showing is
    // now stale by definition. Reloading is the point of saving.
    this.reload();
  }

  private async load(locationId: string, enrich: boolean): Promise<void> {
    const token = ++this.request;

    if (locationId === '') {
      this.loading.set(false);
      this.data.set(null);
      this.failure.set({
        kind: 'missing',
        title: 'No client selected',
        detail: 'Open this queue from a client in your portfolio.',
        retryable: false,
      });
      return;
    }

    this.loading.set(true);
    this.failure.set(null);

    const result = await this.followUp.queue(locationId, { enrich });
    if (token !== this.request) return;

    this.loading.set(false);

    if (result.error) {
      // An empty queue and an unreachable queue look identical if the failure
      // is dropped, and one of them means "you are done for the day".
      this.data.set(null);
      this.failure.set(classifyGhlError(result.error));
      return;
    }

    this.data.set(result.data);
  }
}
