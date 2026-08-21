import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ErrorState, LoadingState, PageShell } from '../../../shared/ui';
import { WidgetRegistryService } from '../../../shared/widgets/widget-registry.service';
import { DashboardConfigService } from '../services/dashboard-config.service';
import { WidgetHost } from '../widget-host/widget-host';
import type { DashboardPage, WidgetPlacement } from '../../../shared/widgets/widget.model';
import type { LastUpdated } from '../services/dashboard.model';

/**
 * The configurable dashboard: page tabs, and a grid of widgets resolved by id.
 *
 * The shell knows no integration by name. It reads a layout, hands each
 * placement's `widgetId` to `WidgetHost`, and the registry does the rest —
 * which is what lets a GHL widget import GHL services while this component
 * stays ignorant that GHL exists.
 *
 * Three behaviours carried across from the reference implementation, one of
 * them a fix:
 *
 * - `?page=<id>` selects a tab. In the Next app `PageTabs` linked to
 *   `/dashboard?page=<id>` and nothing ever read the parameter, so every tab
 *   rendered the saved current page and multi-page dashboards were a no-op.
 *   The parameter is read here and resolved server-side, with an unknown id
 *   falling back to the saved page rather than erroring.
 * - Removed widgets are announced. The server strips placements this hat may no
 *   longer use and names them in `removedWidgetIds`; a tile that silently
 *   disappears reads as a bug, so this says which one went and why.
 * - Sample data is disclosed at the page level as well as inside each widget,
 *   because the page-level statement is what a reader sees before they start
 *   trusting individual numbers.
 */
@Component({
  selector: 'app-dashboard-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatIconModule, PageShell, ErrorState, LoadingState, WidgetHost],
  templateUrl: './dashboard-shell.html',
  styleUrl: './dashboard-shell.scss',
})
export class DashboardShell {
  private readonly configApi = inject(DashboardConfigService);
  private readonly registry = inject(WidgetRegistryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly pages = signal<readonly DashboardPage[]>([]);
  protected readonly currentPageId = signal<string | null>(null);
  protected readonly removedWidgetIds = signal<readonly string[]>([]);
  protected readonly sampleDataWidgetIds = signal<readonly string[]>([]);
  protected readonly lastUpdated = signal<LastUpdated>({ timestamp: null, source: null });

  protected readonly currentPage = computed<DashboardPage | null>(() => {
    const id = this.currentPageId();
    return this.pages().find((page) => page.id === id) ?? null;
  });

  protected readonly widgets = computed<readonly WidgetPlacement[]>(
    () => this.currentPage()?.widgets ?? [],
  );

  protected readonly hasTabs = computed(() => this.pages().length > 1);

  /**
   * Named, not counted. "Team Health was removed" tells someone what changed;
   * "1 widget was removed" makes them go looking for it.
   */
  protected readonly removedLabel = computed(() => {
    const ids = this.removedWidgetIds();
    if (ids.length === 0) return null;
    const titles = ids.map((id) => this.registry.getDefinition(id)?.title ?? id);
    const list = titles.join(', ');
    const verb = titles.length === 1 ? 'is' : 'are';
    return `${list} ${verb} no longer available for the hat you are wearing, so ${
      titles.length === 1 ? 'it has' : 'they have'
    } been left off this page.`;
  });

  /**
   * True when any widget on the page shows fabricated numbers. The per-widget
   * disclosure still renders inside each tile; this is the statement made
   * before the reader has scrolled to any of them.
   */
  protected readonly showsSampleData = computed(() => {
    const sample = new Set(this.sampleDataWidgetIds());
    return this.widgets().some((placement) => sample.has(placement.widgetId));
  });

  protected readonly freshnessLabel = computed(() => {
    const { timestamp, source } = this.lastUpdated();
    if (timestamp === null) return null;
    const when = new Date(timestamp).toLocaleString();
    return source === null ? `Data as of ${when}` : `Data as of ${when} (${sourceLabel(source)})`;
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const requestedPage = this.route.snapshot.queryParamMap.get('page');
    const result = await this.configApi.load(requestedPage);

    if (result.error) {
      // Cleared, not kept: a stale layout rendered behind an error would keep
      // fetching widget data for a config we no longer know is current.
      this.pages.set([]);
      this.currentPageId.set(null);
      this.removedWidgetIds.set([]);
      this.sampleDataWidgetIds.set([]);
      this.error.set(result.error.message);
      this.loading.set(false);
      return;
    }

    const data = result.data;
    this.pages.set(data.config.pages);
    this.currentPageId.set(data.currentPageId);
    this.removedWidgetIds.set(data.removedWidgetIds);
    this.sampleDataWidgetIds.set(data.sampleDataWidgetIds);
    this.lastUpdated.set(data.lastUpdated);
    this.loading.set(false);
  }

  /**
   * Switching tabs writes `?page=` and re-reads locally.
   *
   * No refetch: the config request already returned every page, and asking the
   * server again would re-run the freshness lookup and the entitlement filter
   * to produce a layout we are already holding.
   */
  protected selectPage(pageId: string): void {
    this.currentPageId.set(pageId);

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: pageId },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /**
   * The grid span for this placement, as classes rather than an inline style.
   *
   * Inline styles win over every stylesheet rule including media queries, so an
   * inline `grid-column: span 4` would keep a four-wide tile four-wide inside a
   * one-column phone grid — the tile would simply overflow. Classes let the
   * breakpoint decide, which is what makes "one responsive shell, not two
   * layouts" true here. `cols` and `rows` are integers 1 to 4, validated
   * server-side, so the class set is small and closed.
   */
  protected cellClass(placement: WidgetPlacement): string {
    const cols = clampSpan(placement.size.cols);
    const rows = clampSpan(placement.size.rows);
    return `dashboard__cell dashboard__cell--c${cols} dashboard__cell--r${rows}`;
  }
}

/**
 * A defensive clamp on a value the server already validates.
 *
 * It exists so a stored layout from before that validation — or from a future
 * registry entry declaring something wider — degrades to a legal tile instead
 * of producing a class name with no rule behind it, which would render as an
 * unstyled full-width cell with no clue why.
 */
function clampSpan(value: number): number {
  return Math.min(4, Math.max(1, Math.round(value)));
}

function sourceLabel(source: NonNullable<LastUpdated['source']>): string {
  switch (source) {
    case 'appointment_outcome':
      return 'appointment outcome';
    case 'contact_added':
      return 'contact added';
    case 'meta_fetch':
      return 'Meta sync';
  }
}
