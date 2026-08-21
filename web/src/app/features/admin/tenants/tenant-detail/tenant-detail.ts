import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ErrorState, LoadingState, PageShell } from '../../../../shared/ui';
import { AdminTenantsService } from '../../services/admin-tenants.service';
import {
  SERVICE_IDS,
  SERVICE_LABELS,
  type OwnerModel,
  type ServiceId,
  type Tenant,
  type TenantSettings,
} from '../../services/admin-tenants.model';

/**
 * One tenant's entitlements, owner model and Meta ids.
 *
 * `name` is shown and not editable. It syncs from GHL, and an editable copy
 * here would make this the second place a client's name is typed — after which
 * the two disagree and neither is obviously wrong. The endpoint refuses to
 * write it regardless.
 *
 * Meta ids submit as strings including `""`. Firestore is configured with
 * `ignoreUndefinedProperties`, so an omitted field is a no-op under a merge
 * write: clearing a pixel id by deleting the field would leave the old value in
 * place and the admin would watch it reappear on reload.
 */
@Component({
  selector: 'app-tenant-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    PageShell,
    ErrorState,
    LoadingState,
  ],
  templateUrl: './tenant-detail.html',
  styleUrl: './tenant-detail.scss',
})
export class TenantDetail {
  private readonly service = inject(AdminTenantsService);
  private readonly route = inject(ActivatedRoute);

  /**
   * Read from the paramMap stream, not from the snapshot.
   *
   * The router reuses this component when only the parameter changes, so a
   * snapshot read would show the first tenant's settings under the second
   * tenant's URL — and the save button would then write one client's
   * entitlements onto another. `withComponentInputBinding()` would give the
   * same result through an input, but app.config.ts does not enable it and
   * this feature does not own that file.
   */
  protected readonly locationId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('locationId') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('locationId') ?? '' },
  );

  protected readonly serviceIds = SERVICE_IDS;
  protected readonly serviceLabels = SERVICE_LABELS;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly tenant = signal<Tenant | null>(null);
  /**
   * Whether a document exists yet. Kept separate from the tenant body because
   * `getTenant` fails closed with placeholders — without this, a location that
   * has never been configured looks identical to a real one whose fields match
   * the defaults, and the page would claim to be editing something that is not
   * there.
   */
  protected readonly exists = signal(false);

  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly saved = signal(false);

  protected readonly form = new FormGroup({
    vslFunnel: new FormControl(false, { nonNullable: true }),
    adManagement: new FormControl(false, { nonNullable: true }),
    closingTeam: new FormControl(false, { nonNullable: true }),
    website: new FormControl(false, { nonNullable: true }),
    salesEnablement: new FormControl(false, { nonNullable: true }),
    ownerModel: new FormControl<OwnerModel>('client', { nonNullable: true }),
    metaAdAccountId: new FormControl('', { nonNullable: true }),
    metaBusinessId: new FormControl('', { nonNullable: true }),
    metaPixelId: new FormControl('', { nonNullable: true }),
  });

  protected readonly heading = computed(() => this.tenant()?.name ?? this.locationId());

  protected readonly subtitle = computed(() =>
    this.exists()
      ? this.locationId()
      : `${this.locationId()} — no tenant record yet. Saving creates one.`,
  );

  constructor() {
    // "Saved." must not outlive the state it describes.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.saved.set(false));

    effect(() => {
      void this.load(this.locationId());
    });
  }

  protected async load(locationId = this.locationId()): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);

    const result = await this.service.get(locationId);

    if (result.error) {
      this.tenant.set(null);
      this.exists.set(false);
      this.loadError.set(result.error.message);
      this.loading.set(false);
      return;
    }

    const { tenant, exists } = result.data;
    this.tenant.set(tenant);
    this.exists.set(exists);
    this.form.setValue({
      vslFunnel: tenant.services.vslFunnel,
      adManagement: tenant.services.adManagement,
      closingTeam: tenant.services.closingTeam,
      website: tenant.services.website,
      salesEnablement: tenant.services.salesEnablement,
      ownerModel: tenant.ownerModel,
      metaAdAccountId: tenant.metaAdAccountId ?? '',
      metaBusinessId: tenant.metaBusinessId ?? '',
      metaPixelId: tenant.metaPixelId ?? '',
    });
    this.saved.set(false);
    this.loading.set(false);
  }

  protected serviceControl(service: ServiceId): FormControl<boolean> {
    return this.form.controls[service];
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;

    this.saving.set(true);
    this.saveError.set(null);
    this.saved.set(false);

    const result = await this.service.save(this.locationId(), this.settings());
    this.saving.set(false);

    if (result.error) {
      this.saveError.set(result.error.message);
      return;
    }

    // The saved tenant comes back from the endpoint; taking it rather than
    // assuming the form landed means the header and the `exists` note describe
    // what is actually stored.
    this.tenant.set(result.data.tenant);
    this.exists.set(true);
    this.saved.set(true);
  }

  private settings(): TenantSettings {
    const raw = this.form.getRawValue();
    const services = {} as Record<ServiceId, boolean>;
    for (const service of SERVICE_IDS) services[service] = raw[service];

    return {
      services,
      ownerModel: raw.ownerModel,
      metaAdAccountId: raw.metaAdAccountId.trim(),
      metaBusinessId: raw.metaBusinessId.trim(),
      metaPixelId: raw.metaPixelId.trim(),
    };
  }
}
