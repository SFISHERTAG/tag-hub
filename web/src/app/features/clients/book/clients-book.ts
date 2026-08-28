import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { Sort } from '@angular/material/sort';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageShell,
  SampleDataNotice,
} from '../../../shared/ui';
import { ClientsService } from '../services/clients.service';
import { ClientGrid } from './views/client-grid/client-grid';
import { ClientList } from './views/client-list/client-list';
import { ClientKanban } from './views/client-kanban/client-kanban';
import { ClientEscalation } from './views/client-escalation/client-escalation';
import type {
  ClientBookQuery,
  ClientData,
  ClientSortKey,
  ClientStatusFilter,
  SampleDataDisclosure,
  SortOrder,
} from '../services/client.model';

export type BookView = 'grid' | 'list' | 'kanban' | 'escalations';

const VIEWS: readonly BookView[] = ['grid', 'list', 'kanban', 'escalations'];

const STATUS_FILTERS: readonly { value: ClientStatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'healthy', label: 'Healthy' },
  { value: 'at-risk', label: 'At risk' },
  { value: 'critical', label: 'Critical' },
  { value: 'alert', label: 'Alert' },
];

const SORT_KEYS: readonly { value: ClientSortKey; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'health', label: 'Health score' },
  { value: 'roas', label: 'ROAS target' },
  { value: 'spend', label: 'Budget' },
];

/** The endpoint's own sortable set. A control offering more would 400. */
const SORTABLE = new Set<string>(SORT_KEYS.map((key) => key.value));

/**
 * The book of business — one client list, four ways of looking at it.
 *
 * Search, status and sort run server-side, so the four views are always
 * looking at the same rows in the same order. The reference implementation
 * filtered in the browser over whatever had been fetched, which meant a search
 * silently searched a partial set whenever the fetch was incomplete.
 *
 * Two states this screen refuses to conflate:
 *
 * - A failed load is an error, not an empty book. `clients` is cleared on
 *   failure so no stale rows sit behind the message looking current, and the
 *   error names a retry. Telling a CSM they have no clients during an outage
 *   is the failure the ApiResult contract exists to prevent.
 * - "No clients assigned" and "no clients match your filters" are different
 *   sentences, because the fix for each is different.
 *
 * The health numbers on every one of these rows are fabricated and identical
 * for every client; `SampleDataNotice` renders the server's disclosure, and
 * each badge carries its own marker on top of that.
 */
@Component({
  selector: 'app-clients-book',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    PageShell,
    EmptyState,
    ErrorState,
    LoadingState,
    SampleDataNotice,
    ClientGrid,
    ClientList,
    ClientKanban,
    ClientEscalation,
  ],
  templateUrl: './clients-book.html',
  styleUrl: './clients-book.scss',
})
export class ClientsBook {
  private readonly clientsApi = inject(ClientsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly statusFilters = STATUS_FILTERS;
  protected readonly sortKeys = SORT_KEYS;

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly clients = signal<readonly ClientData[]>([]);
  protected readonly sampleData = signal<SampleDataDisclosure | null>(null);

  protected readonly view = signal<BookView>('grid');
  protected readonly search = signal('');
  protected readonly status = signal<ClientStatusFilter>('all');
  protected readonly sortBy = signal<ClientSortKey>('name');
  protected readonly sortOrder = signal<SortOrder>('asc');

  protected readonly searchControl = new FormControl('', { nonNullable: true });

  /**
   * Guards against an out-of-order response overwriting a newer one. Typing
   * quickly fires overlapping requests, and without this the slowest reply wins
   * and the list stops matching the box.
   */
  private requestId = 0;

  /** What the table's sort headers show. Mirrors the query, never leads it. */
  protected readonly tableSort = computed<Sort>(() => ({
    active: this.sortBy(),
    direction: this.sortOrder(),
  }));

  protected readonly hasFilters = computed(
    () => this.search().length > 0 || this.status() !== 'all',
  );

  protected readonly countLabel = computed(() => {
    const count = this.clients().length;
    return `${count} ${count === 1 ? 'client' : 'clients'}`;
  });

  constructor() {
    const params = this.route.snapshot.queryParamMap;

    // `?view=escalations` is the deep link portfolio.routes.ts forwards. An
    // unrecognised value falls back to the grid rather than rendering nothing,
    // so a stale bookmark degrades instead of breaking.
    this.view.set(toView(params.get('view')));

    const search = params.get('search') ?? '';
    this.search.set(search);
    this.searchControl.setValue(search, { emitEvent: false });

    this.searchControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((value) => {
        this.search.set(value);
        void this.load();
      });

    void this.load();
  }

  protected async load(): Promise<void> {
    const id = ++this.requestId;

    this.loading.set(true);
    this.error.set(null);

    const query: ClientBookQuery = {
      search: this.search(),
      status: this.status(),
      sortBy: this.sortBy(),
      sortOrder: this.sortOrder(),
    };

    const result = await this.clientsApi.listClients(query);

    if (id !== this.requestId) return;

    if (result.error) {
      // Cleared, not kept. An error must never render behind rows that look
      // current — the same precedence the shared DataTable enforces internally.
      this.clients.set([]);
      this.sampleData.set(null);
      this.error.set(result.error.message);
      this.loading.set(false);
      return;
    }

    this.clients.set(result.data.clients);
    this.sampleData.set(result.data.sampleData);
    this.loading.set(false);
  }

  /**
   * These three take `unknown` rather than their narrow type on purpose.
   *
   * `MatButtonToggleChange.value` and `MatSelect`'s `valueChange` are both typed
   * `any` by Material, so a template binding hands them straight through and
   * strictTemplates has nothing to check. Accepting `unknown` and narrowing here
   * puts the check back where it can actually run, and means an option value
   * that gets mistyped in the template degrades to the default instead of
   * reaching the API as an unrecognised string and coming back a 400.
   */
  protected setView(value: unknown): void {
    const view = toView(asString(value));
    this.view.set(view);

    // The view lives in the URL so a bookmark, a back button and the
    // `?view=escalations` redirect all land on the same screen. `replaceUrl`
    // keeps a view toggle out of the history stack.
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected setStatus(value: unknown): void {
    const raw = asString(value);
    const status = STATUS_FILTERS.find((option) => option.value === raw)?.value ?? 'all';
    this.status.set(status);
    void this.load();
  }

  protected setSortBy(value: unknown): void {
    const raw = asString(value);
    const sortBy = SORT_KEYS.find((option) => option.value === raw)?.value ?? 'name';
    this.sortBy.set(sortBy);
    void this.load();
  }

  protected toggleSortOrder(): void {
    this.sortOrder.update((order) => (order === 'asc' ? 'desc' : 'asc'));
    void this.load();
  }

  /**
   * A header click from the table view. Only the four keys the endpoint
   * accepts are honoured; clearing the sort returns to the default rather than
   * sending an empty `sortBy` the API would reject.
   */
  protected onTableSort(sort: Sort): void {
    if (sort.direction === '' || !SORTABLE.has(sort.active)) {
      this.sortBy.set('name');
      this.sortOrder.set('asc');
    } else {
      this.sortBy.set(sort.active as ClientSortKey);
      this.sortOrder.set(sort.direction);
    }
    void this.load();
  }

  protected clearFilters(): void {
    this.status.set('all');
    this.search.set('');
    this.searchControl.setValue('', { emitEvent: false });
    void this.load();
  }
}

function toView(raw: string | null): BookView {
  return raw !== null && (VIEWS as readonly string[]).includes(raw) ? (raw as BookView) : 'grid';
}

/** Narrows a Material event payload, which the library types as `any`. */
function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
