import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { EmptyState, ErrorState, LoadingState } from '../../../../shared/ui';
import { GhlWidgetsService } from '../../services/ghl-widgets.service';
import type { CallForDisplay, WidgetWarning } from '../../services/ghl-widgets.model';

/** Enough to read at a glance on a 2x1 tile; the full day lives on /ghl/today. */
const VISIBLE_CALLS = 4;

/**
 * `day_view` — today's appointments.
 *
 * ## Times are rendered, never computed
 *
 * Only `startTimeFormatted` is displayed. The raw ISO `startTime` is used for
 * the `@for` key and nothing else. Formatting it here would use the viewer's
 * timezone rather than the tenant's, so an evening appointment would render on
 * the wrong day for anyone east or west of the client. The server already
 * resolved the day window in the tenant's zone, which is the whole reason the
 * formatted strings are on the wire at all.
 *
 * ## Empty and unreachable are different states, and the route says so
 *
 * `{ ok: true, calls: [] }` is a real reading: nothing is booked today. It gets
 * `EmptyState`. `{ ok: false, message }` is a calendar that could not be read,
 * and it gets `ErrorState`. Collapsing them is the defect this endpoint's own
 * comment warns about, and it is not hypothetical here: the no-location case
 * returns `ok: false` **inside an HTTP 200**, so `ApiResult.error` is null and
 * every account that has not finished setup would silently show "no calls
 * today" instead of "finish connecting your calendar".
 *
 * ## Warnings survive the error branch here
 *
 * Unlike the funnel, a payload-level failure on this endpoint arrives *with* a
 * warning that explains it (`no_location`). So `fail()` keeps the warnings when
 * the failure came from the payload and drops them when it came from the
 * transport, where they are absent or stale anyway. The error message alone
 * would say "No GHL location configured yet"; the warning is what says what to
 * do about it.
 */
@Component({
  selector: 'app-day-view-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState, ErrorState, LoadingState],
  templateUrl: './day-view-widget.html',
  styleUrl: './day-view-widget.scss',
})
export class DayViewWidget {
  private readonly widgets = inject(GhlWidgetsService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly calls = signal<readonly CallForDisplay[] | null>(null);
  protected readonly warnings = signal<readonly WidgetWarning[]>([]);

  protected readonly visible = computed(() => this.calls()?.slice(0, VISIBLE_CALLS) ?? []);

  protected readonly overflow = computed(() => {
    const total = this.calls()?.length ?? 0;
    return total > VISIBLE_CALLS ? total - VISIBLE_CALLS : 0;
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.widgets.getDayView();

    if (result.error) {
      this.fail(result.error.message, []);
      return;
    }

    const { dayView, warnings } = result.data;

    // A 200 that carries a failure. Nothing above this line treats it as one.
    if (!dayView.ok) {
      this.fail(dayView.message, warnings);
      return;
    }

    this.calls.set(dayView.calls);
    this.warnings.set(warnings);
    this.loading.set(false);
  }

  /** Clears the schedule with the error, so no stale list survives behind it. */
  private fail(message: string, warnings: readonly WidgetWarning[]): void {
    this.calls.set(null);
    this.warnings.set(warnings);
    this.error.set(message);
    this.loading.set(false);
  }
}
