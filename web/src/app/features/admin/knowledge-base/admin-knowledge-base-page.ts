import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DataTable, PageShell, type DataTableColumn } from '../../../shared/ui';
import { AdminKnowledgeBaseService } from '../services/admin-knowledge-base.service';
import type { ManualPageSummary } from '../services/admin-knowledge-base.model';

/**
 * The CSM operating manual, as an editor sees it.
 *
 * `num` sorts as text on purpose: the manual numbers its pages "1.2", "10.1",
 * and a numeric coercion would put 10.1 between 1.2 and 2. The strings are
 * zero-padded in the source, so lexical order is the intended order.
 */
@Component({
  selector: 'app-admin-knowledge-base-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageShell, DataTable],
  templateUrl: './admin-knowledge-base-page.html',
  styleUrl: './admin-knowledge-base-page.scss',
})
export class AdminKnowledgeBasePage {
  private readonly service = inject(AdminKnowledgeBaseService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly pages = signal<readonly ManualPageSummary[]>([]);

  protected readonly countLabel = computed(() => {
    const count = this.pages().length;
    return `${count} ${count === 1 ? 'page' : 'pages'}`;
  });

  protected readonly columns: readonly DataTableColumn<ManualPageSummary>[] = [
    { key: 'num', header: 'No.', cell: (page) => page.num, sortable: true },
    {
      key: 'title',
      header: 'Title',
      cell: (page) => page.title,
      sortable: true,
      link: (page) => ['/admin/knowledge-base', page.id],
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
