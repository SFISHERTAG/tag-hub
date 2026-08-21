import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ErrorState, LoadingState, PageShell } from '../../../shared/ui';
import { DashboardConfigService } from '../services/dashboard-config.service';
import {
  canGrow,
  canShrink,
  moveWidget,
  resizeWidget,
  toggleWidget,
  withPage,
  type SizeAxis,
} from '../services/layout-edit';
import type {
  DashboardConfig,
  DashboardPage,
  WidgetDefinition,
  WidgetPlacement,
} from '../../../shared/widgets/widget.model';

/**
 * Add, remove, reorder and resize the widgets on the current dashboard page.
 *
 * Every edit saves immediately — there is no Save button, exactly as in the
 * reference implementation, and the "Done" link is navigation rather than a
 * commit. What is different is what happens when a save fails: the layout is
 * rolled back to the last state the server confirmed, and the failure is shown.
 * The Next version applied the edit locally, showed an error, and left the
 * screen displaying a layout that had not been saved — so the next reload
 * silently undid work the user had watched succeed.
 *
 * The widget picker is NOT the entitlement boundary and this screen does not
 * pretend otherwise. The list comes from `availableWidgets`, which the server
 * computes from the current role, and `PUT /api/dashboard/config` re-checks
 * every widget id against that same list and refuses the save with a 403. A
 * caller that ignores this screen entirely gains nothing.
 */
@Component({
  selector: 'app-dashboard-customize',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatIconModule, PageShell, ErrorState, LoadingState],
  templateUrl: './dashboard-customize.html',
  styleUrl: './dashboard-customize.scss',
})
export class DashboardCustomize {
  private readonly configApi = inject(DashboardConfigService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly config = signal<DashboardConfig | null>(null);
  protected readonly currentPageId = signal<string | null>(null);
  protected readonly availableWidgets = signal<readonly WidgetDefinition[]>([]);
  protected readonly sampleDataWidgetIds = signal<readonly string[]>([]);

  protected readonly currentPage = computed<DashboardPage | null>(() => {
    const id = this.currentPageId();
    return this.config()?.pages.find((page) => page.id === id) ?? null;
  });

  protected readonly placements = computed<readonly WidgetPlacement[]>(
    () => this.currentPage()?.widgets ?? [],
  );

  protected readonly activeIds = computed(
    () => new Set(this.placements().map((placement) => placement.widgetId)),
  );

  private readonly sampleIds = computed(() => new Set(this.sampleDataWidgetIds()));

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.saveError.set(null);

    const result = await this.configApi.load();

    if (result.error) {
      this.config.set(null);
      this.currentPageId.set(null);
      this.availableWidgets.set([]);
      this.error.set(result.error.message);
      this.loading.set(false);
      return;
    }

    this.config.set(result.data.config);
    this.currentPageId.set(result.data.currentPageId);
    this.availableWidgets.set(result.data.availableWidgets);
    this.sampleDataWidgetIds.set(result.data.sampleDataWidgetIds);
    this.loading.set(false);
  }

  protected isActive(widget: WidgetDefinition): boolean {
    return this.activeIds().has(widget.id);
  }

  protected isSample(widgetId: string): boolean {
    return this.sampleIds().has(widgetId);
  }

  protected titleOf(placement: WidgetPlacement): string {
    return (
      this.availableWidgets().find((widget) => widget.id === placement.widgetId)?.title ??
      placement.widgetId
    );
  }

  protected sizeLabel(placement: WidgetPlacement): string {
    return `${placement.size.cols} wide by ${placement.size.rows} tall`;
  }

  protected canGrow(placement: WidgetPlacement, axis: SizeAxis): boolean {
    return canGrow(placement, axis);
  }

  protected canShrink(placement: WidgetPlacement, axis: SizeAxis): boolean {
    return canShrink(placement, axis);
  }

  protected toggle(widget: WidgetDefinition): void {
    this.apply((page) => toggleWidget(page, widget.id, this.availableWidgets()));
  }

  protected move(index: number, delta: -1 | 1): void {
    this.apply((page) => moveWidget(page, index, delta));
  }

  protected resize(index: number, axis: SizeAxis, delta: 1 | -1): void {
    this.apply((page) => resizeWidget(page, index, axis, delta));
  }

  /**
   * Optimistic edit, real rollback.
   *
   * The new layout shows immediately because every one of these edits is a
   * direct manipulation and waiting on a round trip makes the buttons feel
   * broken. If the save fails the previous layout is restored, so the screen
   * always shows what is actually stored — a screen that keeps a rejected edit
   * on display is worse than one that never showed it.
   */
  private apply(edit: (page: DashboardPage) => DashboardPage): void {
    const config = this.config();
    const page = this.currentPage();
    if (!config || !page || this.saving()) return;

    const nextPage = edit(page);
    if (nextPage === page) return;

    const nextConfig = withPage(config, nextPage);
    this.config.set(nextConfig);

    void this.persist(nextConfig, config);
  }

  private async persist(next: DashboardConfig, previous: DashboardConfig): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);

    const result = await this.configApi.save(next);
    this.saving.set(false);

    if (result.error) {
      this.config.set(previous);
      this.saveError.set(result.error.message);
      return;
    }

    // The server stamps `updatedAt` and is the authority on what was stored, so
    // its echo replaces the local copy rather than the local copy standing in
    // for it.
    this.config.set(result.data.config);
  }
}
