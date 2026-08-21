import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DataTable, PageShell, type DataTableColumn } from '../../../shared/ui';
import { KnowledgeBaseService } from '../services/knowledge-base.service';
import type { ManualPageSummary } from '../services/manual.model';

/**
 * The TAG CSM Operating Manual, page by page.
 *
 * A table rather than cards: this is a reference document people arrive at
 * knowing roughly which section they want, and a sortable index is what serves
 * that. Titles are real anchors through the table's `link` column, so a page
 * opens in a background tab like any other reference.
 *
 * `num` sorts as text deliberately — the manual numbers pages "1.2", "10.1",
 * and coercing to a number would file 10.1 between 1.2 and 2.
 */
@Component({
  selector: 'app-manual-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageShell, DataTable],
  templateUrl: './manual-list.html',
  styleUrl: './manual-list.scss',
})
export class ManualList {
  private readonly service = inject(KnowledgeBaseService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly pages = signal<readonly ManualPageSummary[]>([]);

  protected readonly countLabel = computed(() => {
    const count = this.pages().length;
    return `TAG CSM Operating Manual · ${count} ${count === 1 ? 'page' : 'pages'}`;
  });

  protected readonly columns: readonly DataTableColumn<ManualPageSummary>[] = [
    { key: 'num', header: 'No.', cell: (page) => page.num, sortable: true },
    {
      key: 'title',
      header: 'Title',
      cell: (page) => page.title,
      sortable: true,
      link: (page) => ['/knowledge-base', page.id],
    },
    { key: 'eyebrow', header: 'Section', cell: (page) => page.eyebrow, sortable: true },
    { key: 'status', header: 'Status', cell: (page) => page.status, sortable: true },
  ];

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.service.list();

    if (result.error) {
      this.pages.set([]);
      this.error.set(result.error.message);
      this.loading.set(false);
      return;
    }

    this.pages.set(result.data.pages);
    this.loading.set(false);
  }
}
