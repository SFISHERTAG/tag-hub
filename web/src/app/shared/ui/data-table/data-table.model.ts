/**
 * A column is a pure projection from a row to a string, plus how to sort it.
 *
 * Everything is a function of `T` rather than a property name, so the table
 * never reaches into a row by string key. That is what keeps it generic
 * without `any`, and what makes a renamed field a compile error in the feature
 * that owns the data instead of a blank column in production.
 */
export interface DataTableColumn<T> {
  /** Stable id. Also the sort key emitted on `sortChange`. */
  readonly key: string;
  readonly header: string;
  /** What the cell shows. Format here — currency, dates, "-" for missing. */
  readonly cell: (row: T) => string;
  readonly sortable?: boolean;
  /**
   * What the cell sorts by, when the displayed text would sort wrong: "$1,200"
   * before "$900", "2 Feb" before "10 Jan". Defaults to `cell`.
   */
  readonly sortValue?: (row: T) => string | number;
  /**
   * Renders the cell as a routerLink. Rows are not clickable as a whole on
   * purpose: a real anchor is keyboard reachable, announced as a link, and
   * openable in a new tab, none of which a `(click)` on a `<tr>` gives you.
   */
  readonly link?: (row: T) => string | unknown[] | null;
  readonly align?: 'start' | 'end';
}

/** Client-side sorting, or hand the sort to the server and re-fetch. */
export type DataTableSortMode = 'client' | 'server';
