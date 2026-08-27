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
 * So this shows no times. The day-level fields on `CalendarDay` — `date`,
 * `dayOfMonth`, `isToday`, `isCurrentMonth` — are rendered as the server
 * computed them, and this component adds no date arithmetic of its own.
 *
 * **Those fields carry a known server-side defect. Read this before trusting
 * the grid.** In `lib/dashboard/owner-calendar.ts`, `DEFAULT_TIME_ZONE` is
 * applied to exactly one field, `monthLabel` (`:75-79`). Every other date
 * computation uses process-local `Date` methods with no zone: `toDateKey`
 * (`:55-58`, `getFullYear`/`getMonth`/`getDate`), `endOfDay` (`:49-53`),
 * `monthGridRange` (`:62-70`), and the grid loop's `dayOfMonth` / `isToday` /
 * `isCurrentMonth` (`:127-129`).
 *
 * `lib/time/zone.ts:5-9` is the authority on what the process zone is: nothing
 * sets `TZ` in Cloud Run, so Node defaults to **UTC**. So the buckets are UTC
 * while the label is Central. A 7:00 PM Central appointment is 01:00 UTC the
 * next day and lands on tomorrow's cell, and at a month boundary the label and
 * the grid disagree outright.
 *
 * **This is wrong today, for Central, not merely wrong for a future
 * sublocation** — which is the opposite of the situation for
 * `startTimeFormatted` on the day-view endpoint, where a named zone is passed
 * and is simply the wrong one for non-Central locations.
 *
 * Deliberately not worked around here. A component re-deriving these fields
 * would need a zone it does not have, and would put a second date
 * implementation next to the broken one. The fix is to give
 * `owner-calendar.ts` the zone the rest of `lib/` already threads.
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
