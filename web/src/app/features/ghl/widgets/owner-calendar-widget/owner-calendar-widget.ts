import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { EmptyState, ErrorState, LoadingState } from '../../../../shared/ui';
import { GhlWidgetsService } from '../../services/ghl-widgets.service';
import type {
  CalendarDay,
  OwnerAppointment,
  WidgetWarning,
} from '../../services/ghl-widgets.model';

/** A judgement, like DayViewWidget's cap: enough upcoming calls to be useful on a 4x2. */
const VISIBLE_UPCOMING = 5;

/**
 * `owner_calendar` — the owner's month, plus what is coming up.
 *
 * ## The tile is titled "My Calendar" and sometimes it is not yours
 *
 * `calendar.scoped === false` means the tenant has no `ownerGhlUserId`, so the
 * server fell back to **the whole location's** calendar. The route's comment
 * says to surface it because it changes what the view means, and it is right:
 * an unsurfaced `scoped: false` is a tile that contradicts its own title, and
 * the reading it invites ("I have eleven calls tomorrow") is wrong in a way the
 * viewer cannot detect. It renders as a note in the flow, always, not as a
 * tooltip.
 *
 * ## No clock times, and this one is a payload gap rather than a choice
 *
 * `OwnerAppointment` carries a raw ISO `startTime` and **no**
 * `startTimeFormatted`, unlike `CallForDisplay` on the day-view endpoint. The
 * payload also does not carry the tenant's timezone. So there is no way to
 * render a correct clock time here: formatting the ISO in the browser gives the
 * viewer's zone, which is the exact defect `DayViewWidget` guards against, and
 * this endpoint offers no server-side alternative to fall back on.
 *
 * So this shows no times. Day-level information is used freely, because every
 * field on `CalendarDay` — `date`, `dayOfMonth`, `isToday`, `isCurrentMonth` —
 * is computed **server-side** (`lib/dashboard/owner-calendar.ts` buckets with
 * `timeZone: DEFAULT_TIME_ZONE`) rather than from the instant in the browser.
 *
 * "Server-side" is the claim, and **not** "in the tenant's zone": that constant
 * is `America/Chicago` for everyone, and `lib/time/zone.ts` records that no
 * per-tenant or per-location zone exists yet. Day bucketing against one zone is
 * right while every location is Central and wrong for a sublocation elsewhere,
 * where a late-evening appointment falls on the next calendar day. That is a
 * server-side correctness question, not one this component can see or fix.
 *
 * The fix is on the server (add a formatted string the way `CallForDisplay`
 * has one), not here. Rendering a wrong time would be worse than rendering
 * none, so this renders none until that lands.
 *
 * ## The 200 that carries a failure
 *
 * `calendar.ok === false` inside an HTTP 200, including for the no-location
 * case. Same handling as the other three widgets in this folder.
 */
@Component({
  selector: 'app-owner-calendar-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState, ErrorState, LoadingState],
  templateUrl: './owner-calendar-widget.html',
  styleUrl: './owner-calendar-widget.scss',
})
export class OwnerCalendarWidget {
  private readonly widgets = inject(GhlWidgetsService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly warnings = signal<readonly WidgetWarning[]>([]);

  protected readonly monthLabel = signal<string | null>(null);
  protected readonly days = signal<readonly CalendarDay[] | null>(null);
  protected readonly upcoming = signal<readonly OwnerAppointment[] | null>(null);
  protected readonly scoped = signal(true);

  protected readonly visibleUpcoming = computed(
    () => this.upcoming()?.slice(0, VISIBLE_UPCOMING) ?? [],
  );

  protected readonly cells = computed(() =>
    (this.days() ?? []).map((day) => ({
      date: day.date,
      dayOfMonth: day.dayOfMonth,
      isToday: day.isToday,
      isCurrentMonth: day.isCurrentMonth,
      count: day.appointments.length,
    })),
  );

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.widgets.getOwnerCalendar();

    if (result.error) {
      this.fail(result.error.message, []);
      return;
    }

    const { calendar, warnings } = result.data;

    // A 200 that carries a failure. Nothing above this line treats it as one.
    if (!calendar.ok) {
      this.fail(calendar.message, warnings);
      return;
    }

    this.monthLabel.set(calendar.monthLabel);
    this.days.set(calendar.days);
    this.upcoming.set(calendar.upcoming);
    this.scoped.set(calendar.scoped);
    this.warnings.set(warnings);
    this.loading.set(false);
  }

  /** Clears the month with the error, so no stale calendar survives behind it. */
  private fail(message: string, warnings: readonly WidgetWarning[]): void {
    this.days.set(null);
    this.upcoming.set(null);
    this.monthLabel.set(null);
    this.scoped.set(true);
    this.warnings.set(warnings);
    this.error.set(message);
    this.loading.set(false);
  }
}
