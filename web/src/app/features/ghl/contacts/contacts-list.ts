import { ChangeDetectionStrategy, Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DataTable, ErrorState, PageShell, type DataTableColumn } from '../../../shared/ui';
import { ContactsService } from '../services/contacts.service';
import { classifyGhlError, type GhlFailure } from '../services/ghl-error';
import { formatDate, plural } from '../services/ghl-format';
import { injectLocationId } from '../services/location-id';
import type { ContactSummary } from '../services/ghl.model';

const DASH = '—';

/**
 * The client's contacts, searchable by name, email or phone.
 *
 * The query lives in the URL (`?q=acme`) because a search result is a thing
 * people send each other, and GHL does the matching — this screen never filters
 * a local array, which would silently search only the page it happens to hold.
 *
 * Columns are deliberately NOT sortable. The endpoint returns one page and
 * reports `truncated` when it filled it; sorting that page client-side would
 * put "the highest" at the top of a list that does not contain the highest.
 * When sorting matters more than the truncation warning does, it belongs on the
 * endpoint as a parameter, not here as a comparator.
 */
@Component({
  selector: 'app-contacts-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    PageShell,
    DataTable,
    ErrorState,
  ],
  templateUrl: './contacts-list.html',
  styleUrl: './contacts-list.scss',
})
export class ContactsList {
  private readonly contacts = inject(ContactsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly locationId = injectLocationId();

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: convertToParamMap({}),
  });

  protected readonly query = computed(() => this.queryParams().get('q')?.trim() ?? '');

  /** What is in the box. Re-seeded from the URL so the Back button repaints the
   * field as well as the results. */
  protected readonly term = linkedSignal(() => this.query());

  protected readonly loading = signal(true);
  protected readonly failure = signal<GhlFailure | null>(null);
  protected readonly rows = signal<readonly ContactSummary[]>([]);
  protected readonly truncated = signal(false);

  private request = 0;

  protected readonly subtitle = computed(() => {
    if (this.loading() || this.failure() !== null) return null;
    const count = plural(this.rows().length, 'contact');
    return this.truncated() ? `${count} shown, and there are more` : count;
  });

  protected readonly caption = computed(() =>
    this.query() === '' ? 'Contacts for this client' : `Contacts matching "${this.query()}"`,
  );

  protected readonly emptyMessage = computed(() =>
    this.query() === '' ? 'No contacts yet' : `No contacts matching "${this.query()}"`,
  );

  /**
   * Every cell is a function of the row, so a renamed field on ContactSummary
   * is a compile error here rather than a blank column in production.
   */
  protected readonly columns: readonly DataTableColumn<ContactSummary>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (row) => row.displayName,
      // Relative to this route, so the link keeps working wherever the feature
      // is mounted. Rendered as a real anchor by DataTable: keyboard
      // reachable, and openable in a new tab.
      link: (row) => [row.id],
    },
    { key: 'company', header: 'Company', cell: (row) => row.companyName || DASH },
    { key: 'email', header: 'Email', cell: (row) => row.email || DASH },
    { key: 'phone', header: 'Phone', cell: (row) => row.phone || DASH },
    { key: 'source', header: 'Source', cell: (row) => row.source || DASH },
    { key: 'added', header: 'Added', cell: (row) => formatDate(row.dateAdded) },
  ];

  /** Identity for row re-use across a re-search, so the table diffs rather
   * than rebuilding every row. */
  protected readonly rowKey = (row: ContactSummary): string => row.id;

  constructor() {
    effect(() => {
      const locationId = this.locationId();
      const query = this.query();
      void this.load(locationId, query);
    });
  }

  protected setTerm(next: unknown): void {
    this.term.set(next === null || next === undefined ? '' : String(next));
  }

  /** Puts the search in the URL and lets the effect above do the fetching, so
   * there is one path to a result set rather than two that can disagree. */
  protected search(): void {
    const term = this.term().trim();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: term === '' ? null : term },
      queryParamsHandling: 'merge',
    });
  }

  protected reload(): void {
    void this.load(this.locationId(), this.query());
  }

  private async load(locationId: string, query: string): Promise<void> {
    const token = ++this.request;

    if (locationId === '') {
      this.loading.set(false);
      this.rows.set([]);
      this.failure.set({
        kind: 'missing',
        title: 'No client selected',
        detail: 'Open contacts from a client in your portfolio.',
        retryable: false,
      });
      return;
    }

    this.loading.set(true);
    this.failure.set(null);

    const result = await this.contacts.search(locationId, { query });
    if (token !== this.request) return;

    this.loading.set(false);

    if (result.error) {
      this.rows.set([]);
      this.truncated.set(false);
      this.failure.set(classifyGhlError(result.error));
      return;
    }

    this.rows.set(result.data.contacts);
    this.truncated.set(result.data.truncated);
  }
}
