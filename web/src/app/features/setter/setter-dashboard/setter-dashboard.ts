import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { EmptyState, ErrorState, LoadingState, PageShell } from '../../../shared/ui';
import { SetterService } from '../services/setter.service';
import {
  LEAD_PRIORITIES,
  PRIORITY_LABELS,
  formatMinutes,
  type LeadMetric,
  type LeadPriority,
  type SetterDashboardData,
  type SetterMetrics,
} from '../services/setter.model';

/** Speed to lead is a two-minute game, so the board re-reads every 10 seconds. */
const REFRESH_INTERVAL_MS = 10_000;

const EMPTY_METRICS: SetterMetrics = {
  totalLeadsToday: 0,
  contactedToday: 0,
  contactRate: 0,
  averageSpeedMinutes: 0,
  pendingCallbacks: 0,
  qualifiedLeads: 0,
  medianSpeedMinutes: 0,
};

/**
 * The speed-to-lead queue.
 *
 * THE DEFECT THIS SCREEN EXISTS TO NOT REPEAT: when the refresh fails, it says
 * so, loudly, on screen.
 *
 * The Next version polled a route that did not exist. Every refresh 404'd,
 * `response.ok` was false, the catch did nothing, and the board sat frozen on
 * its load-time data with nothing to indicate it. On a queue whose entire
 * purpose is catching a two-minute window, a frozen board that looks live is
 * worse than a blank one: the setter keeps working a list that stopped moving.
 *
 * So: the last-good data is KEPT (a failed refresh is not evidence the queue
 * emptied), and a banner names when the data is from and how long the refresh
 * has been failing. The endpoint's half of this contract is that an upstream
 * failure is a 502 and never a 200 carrying zeros — without that, "no leads
 * today" and "GHL is down" would be the same response and no banner could tell
 * them apart.
 */
@Component({
  selector: 'app-setter-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatIconModule,
    PageShell,
    EmptyState,
    ErrorState,
    LoadingState,
  ],
  templateUrl: './setter-dashboard.html',
  styleUrl: './setter-dashboard.scss',
})
export class SetterDashboard {
  private readonly service = inject(SetterService);

  protected readonly priorities = LEAD_PRIORITIES;
  protected readonly priorityLabels = PRIORITY_LABELS;

  /** Only the FIRST load blanks the screen. A refresh never does. */
  protected readonly loading = signal(true);
  /** Set only when there has never been a successful load. */
  protected readonly error = signal<string | null>(null);

  private readonly data = signal<SetterDashboardData | null>(null);

  /**
   * When the last successful refresh happened, and when the failures started.
   *
   * Both are needed. `refreshedAt` is what the numbers on screen are true as
   * of; `staleSince` is how long they have been standing still. Showing only
   * one leaves the reader to guess the other.
   */
  protected readonly staleSince = signal<Date | null>(null);
  protected readonly staleReason = signal<string | null>(null);

  protected readonly filter = signal<LeadPriority>('urgent');

  protected readonly metrics = computed<SetterMetrics>(() => this.data()?.metrics ?? EMPTY_METRICS);
  protected readonly leads = computed<readonly LeadMetric[]>(() => this.data()?.leads ?? []);
  protected readonly locationId = computed(() => this.data()?.locationId ?? null);

  protected readonly freshLeads = computed(() =>
    this.leads().filter((lead) => lead.priority === 'urgent' && lead.status === 'uncontacted'),
  );

  protected readonly agedCount = computed(
    () => this.leads().filter((lead) => lead.priority === 'aged').length,
  );

  protected readonly visibleLeads = computed(() =>
    this.leads().filter((lead) => lead.priority === this.filter()),
  );

  protected readonly refreshedLabel = computed(() => {
    const refreshedAt = this.data()?.refreshedAt;
    if (!refreshedAt) return null;
    return `Updated ${new Date(refreshedAt).toLocaleTimeString()}`;
  });

  /**
   * The banner's words. Names the failure, when the data is from, and what to
   * do — a warning that only says "something went wrong" leaves the reader
   * unable to decide whether to trust the queue in front of them.
   */
  protected readonly staleLabel = computed(() => {
    const since = this.staleSince();
    if (!since) return null;

    const refreshedAt = this.data()?.refreshedAt;
    const asOf = refreshedAt
      ? `The queue below is from ${new Date(refreshedAt).toLocaleTimeString()} and is not updating.`
      : 'The queue below is not updating.';

    return `Live refresh has been failing since ${since.toLocaleTimeString()}. ${asOf}`;
  });

  constructor() {
    void this.load();

    const timer = setInterval(() => void this.refresh(), REFRESH_INTERVAL_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  /** First load, and the retry behind the error state. Blanks the screen. */
  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.service.load();

    if (result.error) {
      this.error.set(result.error.message);
      this.loading.set(false);
      return;
    }

    this.data.set(result.data);
    this.staleSince.set(null);
    this.staleReason.set(null);
    this.loading.set(false);
  }

  /**
   * The poll. Never blanks anything and never clears the last-good data.
   *
   * A failed refresh is not evidence that the queue emptied — that inference is
   * exactly the "$0 spend" mistake the error contract exists to prevent, and on
   * this board it would read as "all caught up" over a real backlog.
   */
  protected async refresh(): Promise<void> {
    // Nothing to keep stale yet: while the first load is still failing the
    // error state is the honest screen, and a staleness banner over it would
    // be describing data that does not exist.
    if (this.data() === null) return;

    const result = await this.service.load(this.locationId() ?? undefined);

    if (result.error) {
      // First failure stamps the clock; later ones leave it, so the banner
      // reports how long this has been going on rather than resetting to "just
      // now" every ten seconds.
      this.staleSince.update((current) => current ?? new Date());
      this.staleReason.set(result.error.message);
      return;
    }

    this.data.set(result.data);
    this.staleSince.set(null);
    this.staleReason.set(null);
  }

  protected setFilter(priority: LeadPriority): void {
    this.filter.set(priority);
  }

  protected speed(minutes: number | undefined): string {
    return formatMinutes(minutes);
  }

  protected age(lead: LeadMetric): string {
    return lead.ageMinutes < 1 ? 'Just in' : `${lead.ageMinutes}m ago`;
  }

  protected contact(lead: LeadMetric): string {
    return lead.email ?? lead.phone ?? 'No contact details';
  }

  protected isFresh(lead: LeadMetric): boolean {
    return lead.priority === 'urgent' && lead.status === 'uncontacted';
  }

  protected emptyMessage(): string {
    return `Nothing in the ${this.priorityLabels[this.filter()].toLowerCase()} queue.`;
  }
}
