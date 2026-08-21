import { ChangeDetectionStrategy, Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { MatSort, type Sort } from '@angular/material/sort';
import { DataTable } from './data-table';
import type { DataTableColumn, DataTableSortMode } from './data-table.model';

/**
 * Story: the four states are inside this component precisely so no feature can
 * ship the two failures that look identical on screen.
 *
 * A table that renders an empty grid while a request is in flight, and a table
 * that says "nothing here" when the call actually failed. The second one is the
 * audit's "revoked token renders as $0 spend" pattern wearing a different hat:
 * the person reading the screen concludes there is no data, and acts on it. So
 * error outranks rows, and loading outranks both.
 *
 * The sorting tests exist for a narrower reason. Columns display formatted text
 * ("$1,200") and sort by a value ("1200"), and sorting the display string puts
 * $900 above $1,200. That bug is invisible until someone reads the numbers.
 */

interface Client {
  readonly id: string;
  readonly name: string;
  readonly mrr: number;
}

const CLIENTS: readonly Client[] = [
  { id: 'c1', name: 'Client 9', mrr: 900 },
  { id: 'c2', name: 'Client 10', mrr: 1200 },
  { id: 'c3', name: 'Client 2', mrr: 150 },
];

// Typed on Client end to end. If the generic ever collapsed to `any`, these
// arrow bodies would stop being checked and the build would stay green.
const COLUMNS: readonly DataTableColumn<Client>[] = [
  {
    key: 'name',
    header: 'Client',
    cell: (row) => row.name,
    sortable: true,
    link: (row) => ['/clients', row.id],
  },
  {
    key: 'mrr',
    header: 'MRR',
    cell: (row) => `$${row.mrr.toLocaleString('en-US')}`,
    sortValue: (row) => row.mrr,
    sortable: true,
    align: 'end',
  },
];

@Component({
  selector: 'app-data-table-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTable],
  template: `
    <app-data-table
      caption="Clients in your book"
      [columns]="columns"
      [rows]="rows()"
      [loading]="loading()"
      [error]="error()"
      [sortMode]="sortMode()"
      [sort]="sort()"
      [rowKey]="rowKey"
      emptyMessage="No clients yet."
      (sortChange)="lastSort.set($event)"
      (retry)="retries.set(retries() + 1)"
    />
  `,
})
class DataTableHost {
  readonly columns = COLUMNS;
  readonly rows = signal<readonly Client[]>(CLIENTS);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly sortMode = signal<DataTableSortMode>('client');
  readonly sort = signal<Sort | null>(null);
  readonly rowKey = (row: Client): string => row.id;

  readonly lastSort = signal<Sort | null>(null);
  readonly retries = signal(0);
}

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [DataTableHost],
    providers: [provideZonelessChangeDetection(), provideRouter([])],
  });

  const fixture = TestBed.createComponent(DataTableHost);
  fixture.detectChanges();

  const host = fixture.nativeElement as HTMLElement;
  const component = fixture.componentInstance;

  /** Column text in render order, e.g. ['Client 9', '$900', ...]. */
  const cells = (): string[] =>
    Array.from(host.querySelectorAll('td')).map((cell) => cell.textContent?.trim() ?? '');

  const sortBy = (id: string): void => {
    const matSort = fixture.debugElement.query(By.directive(MatSort)).injector.get(MatSort);
    matSort.sort({ id, start: 'asc', disableClear: false });
    fixture.detectChanges();
  };

  return { fixture, host, component, cells, sortBy };
}

describe('DataTable', () => {
  it('renders a header and a row per record', () => {
    const { host } = setup();

    expect(Array.from(host.querySelectorAll('th')).map((th) => th.textContent?.trim())).toEqual([
      'Client',
      'MRR',
    ]);
    expect(host.querySelectorAll('tbody tr').length).toBe(3);
  });

  it('renders cells through the column functions', () => {
    const { cells } = setup();

    expect(cells()).toEqual(['Client 9', '$900', 'Client 10', '$1,200', 'Client 2', '$150']);
  });

  it('names the table for assistive tech', () => {
    const { host } = setup();

    expect(host.querySelector('caption')?.textContent?.trim()).toBe('Clients in your book');
  });

  it('shows loading instead of an empty grid', () => {
    const { fixture, host, component } = setup();
    component.loading.set(true);
    fixture.detectChanges();

    expect(host.querySelector('app-loading-state')).not.toBeNull();
    expect(host.querySelector('table')).toBeNull();
  });

  it('shows the error rather than the rows it already had', () => {
    // The distinction this component exists to keep: a failed refresh must not
    // leave last-known-good data on screen looking current.
    const { fixture, host, component } = setup();
    component.error.set('Could not reach the client list.');
    fixture.detectChanges();

    expect(host.querySelector('app-error-state')).not.toBeNull();
    expect(host.querySelector('table')).toBeNull();
    expect(host.textContent).toContain('Could not reach the client list.');
  });

  it('never shows the empty state for a failed call', () => {
    const { fixture, host, component } = setup();
    component.rows.set([]);
    component.error.set('Could not reach the client list.');
    fixture.detectChanges();

    // "No clients yet." for a 500 is how a broken integration reads as a quiet
    // business fact.
    expect(host.querySelector('app-empty-state')).toBeNull();
    expect(host.querySelector('app-error-state')).not.toBeNull();
  });

  it('shows the empty message when there is genuinely nothing', () => {
    const { fixture, host, component } = setup();
    component.rows.set([]);
    fixture.detectChanges();

    expect(host.querySelector('app-empty-state')).not.toBeNull();
    expect(host.textContent).toContain('No clients yet.');
  });

  it('passes a retry back to the feature', () => {
    const { fixture, host, component } = setup();
    component.error.set('Could not reach the client list.');
    fixture.detectChanges();

    host.querySelector<HTMLButtonElement>('app-error-state button')?.click();
    fixture.detectChanges();

    expect(component.retries()).toBe(1);
  });

  it('sorts by the column value, not the formatted text', () => {
    const { cells, sortBy } = setup();

    sortBy('mrr');

    // Sorting the display string would put "$1,200" before "$150" and "$900".
    expect(cells()).toEqual(['Client 2', '$150', 'Client 9', '$900', 'Client 10', '$1,200']);
  });

  it('reverses on a second click of the same column', () => {
    const { cells, sortBy } = setup();

    sortBy('mrr');
    sortBy('mrr');

    expect(cells()).toEqual(['Client 10', '$1,200', 'Client 9', '$900', 'Client 2', '$150']);
  });

  it('sorts text naturally', () => {
    const { cells, sortBy } = setup();

    sortBy('name');

    // "Client 10" after "Client 9", which a plain string compare gets backwards.
    expect(cells()).toEqual(['Client 2', '$150', 'Client 9', '$900', 'Client 10', '$1,200']);
  });

  it('tells the feature what was sorted', () => {
    const { component, sortBy } = setup();

    sortBy('mrr');

    expect(component.lastSort()).toEqual({ active: 'mrr', direction: 'asc' });
  });

  it('leaves the order alone in server mode', () => {
    const { component, cells, fixture, sortBy } = setup();
    component.sortMode.set('server');
    fixture.detectChanges();

    sortBy('mrr');

    // A paged or truncated list sorted client-side is a lie about the data, so
    // the component only reports the request and waits for a re-fetch.
    expect(cells()).toEqual(['Client 9', '$900', 'Client 10', '$1,200', 'Client 2', '$150']);
    expect(component.lastSort()).toEqual({ active: 'mrr', direction: 'asc' });
  });

  it('does not reorder the array it was handed', () => {
    // Array.prototype.sort mutates. Sorting the input in place would rewrite a
    // parent's signal value behind its back.
    const { sortBy } = setup();

    sortBy('mrr');

    expect(CLIENTS.map((client) => client.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('applies a sort handed down from the parent', () => {
    const { component, fixture, cells } = setup();
    component.sort.set({ active: 'mrr', direction: 'desc' });
    fixture.detectChanges();

    expect(cells()).toEqual(['Client 10', '$1,200', 'Client 9', '$900', 'Client 2', '$150']);
  });

  it('renders a linked column as a real anchor', () => {
    // Not a click handler on the row: an anchor is keyboard reachable,
    // announced as a link, and opens in a new tab.
    const { host } = setup();
    const link = host.querySelector('td a');

    expect(link?.getAttribute('href')).toBe('/clients/c1');
    expect(link?.textContent?.trim()).toBe('Client 9');
  });

  it('leaves unlinked columns as plain text', () => {
    const { host } = setup();
    const valueCells = Array.from(host.querySelectorAll('td')).filter((_, index) => index % 2 === 1);

    expect(valueCells.every((cell) => cell.querySelector('a') === null)).toBe(true);
  });
});
