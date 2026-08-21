import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ClientCard } from '../../client-card/client-card';
import type { ClientData } from '../../../services/client.model';

/** Cards in a responsive grid — the default view of the book. */
@Component({
  selector: 'app-client-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ClientCard],
  template: `
    <ul class="client-grid">
      @for (client of clients(); track client.id) {
        <li class="client-grid__item"><app-client-card [client]="client" /></li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
    }

    .client-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
      gap: 0.75rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .client-grid__item {
      display: flex;
    }
  `,
})
export class ClientGrid {
  readonly clients = input.required<readonly ClientData[]>();
}
