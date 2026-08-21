import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DataTable, PageShell, type DataTableColumn } from '../../../shared/ui';
import { AdminTenantsService } from '../services/admin-tenants.service';
import {
  SERVICE_IDS,
  enabledServiceCount,
  isValidLocationId,
  type Tenant,
} from '../services/admin-tenants.model';

/**
 * Every configured client account.
 *
 * The "add tenant" field navigates rather than writes. A location with no
 * document is not a special case anywhere in the stack: `getTenant` returns
 * fail-closed defaults for one, and the detail screen's save creates it through
 * the same path an edit uses. So there is no create endpoint to call, and no
 * second code path where a new tenant could be given different defaults from an
 * existing one.
 *
 * The id pattern is checked here as a courtesy so a malformed id is never typed
 * in the first place. lib/ghl/tenants.ts re-checks it before the id becomes a
 * Firestore document path, which is the check that matters — `/` in particular
 * would otherwise address something other than a flat document.
 */
@Component({
  selector: 'app-admin-tenants-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    PageShell,
    DataTable,
  ],
  templateUrl: './admin-tenants-page.html',
  styleUrl: './admin-tenants-page.scss',
})
export class AdminTenantsPage {
  private readonly service = inject(AdminTenantsService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly tenants = signal<readonly Tenant[]>([]);

  protected readonly newLocationId = new FormControl('', { nonNullable: true });
  protected readonly addError = signal<string | null>(null);

  protected readonly countLabel = computed(() => {
    const count = this.tenants().length;
    return `${count} ${count === 1 ? 'tenant' : 'tenants'}`;
  });

  protected readonly columns: readonly DataTableColumn<Tenant>[] = [
    {
      key: 'locationId',
      header: 'Location id',
      cell: (tenant) => tenant.locationId,
      sortable: true,
      // Absolute, not relative. A relative target would resolve against
      // whatever route happens to host this table, and this feature is
      // mounted by app.routes.ts rather than by anything in this directory.
      link: (tenant) => ['/admin/tenants', tenant.locationId],
    },
    { key: 'name', header: 'Name', cell: (tenant) => tenant.name, sortable: true },
    {
      key: 'services',
      header: 'Services',
      cell: (tenant) => `${enabledServiceCount(tenant)}/${SERVICE_IDS.length}`,
      sortable: true,
      // Sorted by the count, not by "2/5" as text — otherwise 10 would sort
      // before 2 the day a sixth service is added.
      sortValue: (tenant) => enabledServiceCount(tenant),
      align: 'end',
    },
    {
      key: 'metaPixelId',
      header: 'Meta pixel',
      // An unset pixel reads as "Not set", never as an empty cell: a blank
      // there is indistinguishable from a column that failed to render.
      cell: (tenant) => tenant.metaPixelId || 'Not set',
    },
  ];

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.service.list();

    if (result.error) {
      this.tenants.set([]);
      this.error.set(result.error.message);
      this.loading.set(false);
      return;
    }

    this.tenants.set(result.data.tenants);
    this.loading.set(false);
  }

  protected async add(): Promise<void> {
    const locationId = this.newLocationId.value.trim();
    if (!locationId) return;

    if (!isValidLocationId(locationId)) {
      this.addError.set('A location id can contain only letters, numbers, - and _.');
      return;
    }

    this.addError.set(null);
    await this.router.navigate(['/admin/tenants', locationId]);
  }
}
