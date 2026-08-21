import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
  type TrackByFunction,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, type Sort } from '@angular/material/sort';
import { EmptyState } from '../empty-state/empty-state';
import { ErrorState } from '../error-state/error-state';
import { LoadingState } from '../loading-state/loading-state';
import type { DataTableColumn, DataTableSortMode } from './data-table.model';

/**
 * The generic table every list screen uses.
 *
 * Two things it owns that a hand-rolled mat-table does not. First, the four
 * states are inside it — loading, error, empty, data — so no feature can ship
 * a table that renders an empty grid while a request is in flight, or one that
 * renders "no results" when the call actually failed. That distinction is the
 * whole point: a silent empty table is exactly how the audit's "revoked token
 * renders as $0 spend" bug looked to the person reading the screen.
 *
 * Second, it is typed on `T` end to end. Columns are functions of the row, so
 * there is no string-keyed property access, no `any`, and a field rename fails
 * the build in the feature that owns the data.
 *
 * Sorting defaults to client-side over the rows it was given. Pass
 * `sortMode="server"` when the list is paged or truncated server-side: the
 * component then leaves the order alone and only emits `sortChange`, because
 * sorting the visible page of a truncated list is a lie about the data.
 */
@Component({
  selector: 'app-data-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTableModule, MatSortModule, RouterLink, EmptyState, ErrorState, LoadingState],
  templateUrl: './data-table.html',
  styleUrl: './data-table.scss',
})
export class DataTable<T> {
  readonly columns = input.required<readonly DataTableColumn<T>[]>();
  readonly rows = input<readonly T[]>([]);

  readonly loading = input(false);
  /** An `ApiError.message`. Non-null wins over rows: never show stale data as if it were fresh. */
  readonly error = input<string | null>(null);

  readonly emptyMessage = input('Nothing to show yet.');
  readonly emptyIcon = input('inbox');
  readonly emptyHint = input<string | null>(null);

  /** Describes the table to assistive tech. Say what the rows are. */
  readonly caption = input.required<string>();

  readonly sortMode = input<DataTableSortMode>('client');
  /** Starting sort, and the way a parent re-asserts one after a re-fetch. */
  readonly sort = input<Sort | null>(null);

  /** Identity for row re-use. Falls back to index, which is correct but slower. */
  readonly rowKey = input<((row: T) => string | number) | null>(null);

  readonly sortChange = output<Sort>();
  readonly retry = output<void>();

  /**
   * Owned locally so client sorting works with no parent wiring at all, and
   * re-seeded whenever the parent supplies a new `sort` — a server-mode caller
   * re-fetches on sortChange and pushes the sort it actually applied.
   */
  protected readonly activeSort = linkedSignal<Sort | null>(() => this.sort());

  protected readonly columnKeys = computed(() => this.columns().map((column) => column.key));

  protected readonly visibleRows = computed<readonly T[]>(() => {
    const rows = this.rows();
    const sort = this.activeSort();

    if (this.sortMode() === 'server' || sort === null || sort.direction === '') return rows;

    const column = this.columns().find((candidate) => candidate.key === sort.active);
    if (column === undefined) return rows;

    const factor = sort.direction === 'asc' ? 1 : -1;
    // Copy first: the input array belongs to the caller, and sorting it in
    // place mutates a parent's signal value behind its back.
    return [...rows].sort((a, b) => factor * compare(sortKey(column, a), sortKey(column, b)));
  });

  protected readonly trackRow: TrackByFunction<T> = (index, row) => this.rowKey()?.(row) ?? index;

  protected onSortChange(sort: Sort): void {
    this.activeSort.set(sort);
    this.sortChange.emit(sort);
  }

  /**
   * The template's `let row` is untyped — MatCellDef carries no context guard —
   * so every cell read goes through these two, where it is `T` again.
   */
  protected cellText(column: DataTableColumn<T>, row: T): string {
    return column.cell(row);
  }

  protected cellLink(column: DataTableColumn<T>, row: T): string | unknown[] | null {
    return column.link ? column.link(row) : null;
  }
}

function sortKey<T>(column: DataTableColumn<T>, row: T): string | number {
  return column.sortValue ? column.sortValue(row) : column.cell(row);
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  // `numeric` so "Client 10" sorts after "Client 9" rather than before it.
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}
