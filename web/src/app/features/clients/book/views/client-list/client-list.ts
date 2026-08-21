import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { Sort } from '@angular/material/sort';
import { DataTable, type DataTableColumn } from '../../../../../shared/ui';
import { statusLabel } from '../../../services/client-status';
import type { ClientData } from '../../../services/client.model';

/**
 * The book as a table, on the shared DataTable.
 *
 * Sorting is `server`, not the table's default `client`. The rows here are
 * already sorted by `GET /api/clients?sortBy=&sortOrder=`, and re-sorting them
 * in the browser would produce a second ordering that silently disagrees with
 * the one the query asked for. So the table leaves order alone and emits
 * `sortChange`, and the book re-queries.
 *
 * Columns are functions of the row rather than string keys, which is what makes
 * a renamed field a compile error here instead of a blank column in production.
 */
@Component({
  selector: 'app-client-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTable],
  template: `
    <app-data-table
      [columns]="columns"
      [rows]="clients()"
      [sort]="sort()"
      sortMode="server"
      caption="Clients in this book, with health score and target attainment"
      [rowKey]="rowKey"
      (sortChange)="sortChange.emit($event)"
    />
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class ClientList {
  readonly clients = input.required<readonly ClientData[]>();
  /** The active server-side sort, so the header arrow matches the query. */
  readonly sort = input<Sort | null>(null);

  readonly sortChange = output<Sort>();

  protected readonly rowKey = (client: ClientData): string => client.id;

  /**
   * `sortBy` on the endpoint accepts name | health | roas | spend, so only
   * those four columns are sortable. A sortable header that produced a 400
   * would be worse than a header that does not sort.
   */
  protected readonly columns: readonly DataTableColumn<ClientData>[] = [
    {
      key: 'name',
      header: 'Client',
      cell: (client) => client.name,
      sortable: true,
      link: (client) => ['/clients', client.id],
    },
    {
      key: 'status',
      header: 'Status',
      cell: (client) => statusLabel(client.health.status),
    },
    {
      key: 'health',
      header: 'Health',
      cell: (client) => `${client.health.score}${client.health.is_sample ? ' (sample)' : ''}`,
      sortValue: (client) => client.health.score,
      sortable: true,
      align: 'end',
    },
    {
      key: 'roas',
      header: 'ROAS target',
      cell: (client) => percent(client.metrics?.roas),
      sortValue: (client) => client.metrics?.roas ?? 0,
      sortable: true,
      align: 'end',
    },
    {
      key: 'spend',
      header: 'Budget',
      cell: (client) => percent(client.metrics?.spend),
      sortValue: (client) => client.metrics?.spend ?? 0,
      sortable: true,
      align: 'end',
    },
    {
      key: 'leads',
      header: 'Leads target',
      cell: (client) => percent(client.metrics?.leads),
      align: 'end',
    },
    {
      key: 'alerts',
      header: 'Alerts',
      cell: (client) => (client.alert_count > 0 ? String(client.alert_count) : '-'),
      align: 'end',
    },
  ];
}

/**
 * A missing metric renders as "-", never as 0%.
 *
 * `metrics` is optional on ClientData. Coercing absent to zero would report
 * "0% of ROAS target" for a client nobody has measured yet, which is a much
 * stronger claim than "we have no number".
 */
function percent(value: number | undefined): string {
  return value === undefined ? '-' : `${Math.round(value)}%`;
}
