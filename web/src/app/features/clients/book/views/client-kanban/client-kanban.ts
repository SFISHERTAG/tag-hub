import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ClientCard } from '../../client-card/client-card';
import { STATUS_ORDER, statusDisplay } from '../../../services/client-status';
import type { ClientData, ClientStatus } from '../../../services/client.model';

interface StatusColumn {
  readonly status: ClientStatus;
  readonly title: string;
  readonly tone: string;
  readonly clients: readonly ClientData[];
}

/**
 * The book grouped into columns by health status, worst first.
 *
 * Columns are static, not derived from the data: an empty "Alert" column is
 * information ("nobody is in crisis"), whereas a column that vanishes when it
 * empties makes the reader work out whether it is empty or missing.
 *
 * Nothing here is draggable. The reference implementation was not either, and
 * a status is computed from a health score — it is not a thing a person can
 * move a card into.
 */
@Component({
  selector: 'app-client-kanban',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ClientCard],
  templateUrl: './client-kanban.html',
  styleUrl: './client-kanban.scss',
})
export class ClientKanban {
  readonly clients = input.required<readonly ClientData[]>();

  protected readonly columns = computed<readonly StatusColumn[]>(() => {
    const clients = this.clients();
    return STATUS_ORDER.map((status) => {
      const display = statusDisplay(status);
      return {
        status,
        title: display.label,
        tone: display.tone,
        clients: clients.filter((client) => client.health.status === status),
      };
    });
  });

  protected countLabel(count: number): string {
    return `${count} ${count === 1 ? 'client' : 'clients'}`;
  }
}
