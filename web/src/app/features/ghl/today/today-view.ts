import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, convertToParamMap } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { EmptyState, ErrorState, LoadingState, PageShell } from '../../../shared/ui';
import { AppointmentRow } from './appointment-row';
import { FollowUpPanel } from '../follow-up/follow-up-panel';
import { TodayService } from '../services/today.service';
import { classifyGhlError, type GhlFailure } from '../services/ghl-error';
import { plural } from '../services/ghl-format';
import { injectLocationId } from '../services/location-id';
import { DAY_KEYS, isDayKey, type DayKey, type TodayResponse } from '../services/ghl.model';

const DAY_LABELS: Record<DayKey, string> = {
  yesterday: 'Yesterday',
  today: 'Today',
  tomorrow: 'Tomorrow',
};

/**
 * The closer's day: what is booked, what happened, and who still owes a call.
 *
 * The day is a URL parameter (`?day=tomorrow`) for the same reason the pipeline
 * filter is: it is a view someone links to. The window itself is resolved
 * server-side in the tenant's time zone — a browser-computed "today" starts at
 * the viewer's midnight, and in Cloud Run a naive one started at 7pm the
 * previous evening Central and hid that evening's remaining calls.
 *
 * Show rate is displayed, never computed. `null` renders as "unavailable" and
 * never as 0%: an unreadable outcome store and a day when nobody showed up are
 * opposite facts, and a screen that cannot tell them apart will be believed
 * about the wrong one. The server derives the rate through `getClientHealth`,
 * whose buckets are disjoint per appointment and whose denominator excludes
 * pre-call DQs, so it is structurally bounded at 100% — a second calculation
 * here is exactly how that bound was lost before.
 *
 * Marking an outcome refetches the day QUIETLY: the rows stay on screen while
 * the summary catches up. A skeleton flash after every click makes a closer
 * lose their place in a list they are working down.
 */
@Component({
  selector: 'app-today-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatButtonModule,
    PageShell,
    EmptyState,
    ErrorState,
    LoadingState,
    AppointmentRow,
    FollowUpPanel,
  ],
  templateUrl: './today-view.html',
  styleUrl: './today-view.scss',
})
export class TodayView {
  private readonly today = inject(TodayService);
  private readonly route = inject(ActivatedRoute);

  protected readonly locationId = injectLocationId();
  protected readonly dayKeys = DAY_KEYS;

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: convertToParamMap({}),
  });

  protected readonly day = computed<DayKey>(() => {
    const requested = this.queryParams().get('day');
    return isDayKey(requested) ? requested : 'today';
  });

  protected readonly loading = signal(true);
  protected readonly failure = signal<GhlFailure | null>(null);
  protected readonly data = signal<TodayResponse | null>(null);

  private request = 0;

  protected readonly appointments = computed(() => this.data()?.appointments ?? []);

  protected readonly subtitle = computed(() => {
    const data = this.data();
    if (this.loading() || data === null) return null;
    const booked = plural(data.summary.total, 'appointment');
    return data.summary.total === 0 ? booked : `${booked} · ${data.summary.marked} marked`;
  });

  /**
   * The server's number, rendered as-is. Null is a distinct state and gets its
   * own sentence rather than a zero.
   */
  protected readonly showRateLabel = computed(() => {
    const summary = this.data()?.summary;
    if (summary === undefined) return null;
    return summary.showRatePct === null
      ? 'Show rate unavailable'
      : `${summary.showRatePct}% show rate`;
  });

  protected readonly dqLabel = computed(() => {
    const breakdown = this.data()?.summary.dqBreakdown;
    if (breakdown === undefined || breakdown === null) return null;
    if (breakdown.preCall === 0 && breakdown.onCall === 0) return null;
    return `DQ: ${breakdown.preCall} pre-call, ${breakdown.onCall} on-call`;
  });

  constructor() {
    effect(() => {
      const locationId = this.locationId();
      const day = this.day();
      void this.load(locationId, day, false);
    });
  }

  protected reload(): void {
    void this.load(this.locationId(), this.day(), false);
  }

  /** After a mark: refresh the summary without taking the list off the screen. */
  protected refreshQuietly(): void {
    void this.load(this.locationId(), this.day(), true);
  }

  protected dayLabel(day: DayKey): string {
    return DAY_LABELS[day];
  }

  protected emptyMessage(): string {
    return `Nothing booked for ${this.dayLabel(this.day()).toLowerCase()}.`;
  }

  private async load(locationId: string, day: DayKey, quiet: boolean): Promise<void> {
    const token = ++this.request;

    if (locationId === '') {
      this.loading.set(false);
      this.data.set(null);
      this.failure.set({
        kind: 'missing',
        title: 'No client selected',
        detail: 'Open this day from a client in your portfolio.',
        retryable: false,
      });
      return;
    }

    if (!quiet) this.loading.set(true);
    this.failure.set(null);

    const result = await this.today.day(locationId, day);
    if (token !== this.request) return;

    this.loading.set(false);

    if (result.error) {
      this.data.set(null);
      this.failure.set(classifyGhlError(result.error));
      return;
    }

    this.data.set(result.data);
  }
}
