import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { EmptyState, ErrorState, LoadingState, PageShell } from '../../../shared/ui';
import { ImpersonationService } from '../../../core/services/impersonation.service';
import { PortfolioService } from '../services/portfolio.service';
import type { PortfolioTenant } from '../services/portfolio.model';

/**
 * Where a tenant is entered, the client workspace opens. Ported from the Next
 * server action's `redirect('/l/{id}/pipeline?impersonate=true')`.
 *
 * The route it names lands with Story 10.5 (features/ghl/location). Until then
 * the navigation cannot match, which is why `enter()` treats a failed
 * navigation as a non-event: the impersonation itself already succeeded
 * server-side, and reporting a navigation miss as a failed entry would be a
 * lie that invites a second click and a second audit entry.
 */
const workspaceUrl = (locationId: string): string => `/l/${locationId}/pipeline`;

/**
 * "My clients" — the tenant list, and the way a CSM gets into one.
 *
 * The behaviour this screen exists to preserve, and the reason the story calls
 * it out: a partial failure is shown as a partial failure. The endpoint settles
 * each tenant lookup independently and returns how many did not load; this
 * renders the survivors AND says how many are missing. The Next version used
 * `Promise.all`, so a single unreachable record emptied the switcher and the
 * page read as "no clients assigned" — an outage rendered as a fact about the
 * user's book.
 *
 * Cards rather than the shared DataTable, deliberately: the primary action here
 * is a POST (enter this tenant), and DataTable renders links, not buttons. A
 * row that is not a real anchor is not keyboard-reachable in the way the table
 * promises, so the right answer is not to bend the table.
 */
@Component({
  selector: 'app-portfolio-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatCardModule, PageShell, EmptyState, ErrorState, LoadingState],
  templateUrl: './portfolio-list.html',
  styleUrl: './portfolio-list.scss',
})
export class PortfolioList {
  private readonly portfolio = inject(PortfolioService);
  private readonly impersonation = inject(ImpersonationService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly tenants = signal<readonly PortfolioTenant[]>([]);
  protected readonly unavailableCount = signal(0);
  protected readonly canEnter = signal(false);

  /** The tenant an entry is in flight for, so one click cannot become two. */
  protected readonly entering = signal<string | null>(null);
  protected readonly enterError = signal<string | null>(null);

  /**
   * Read off the session rather than tracked here. The server returns the whole
   * session from the enter call and the impersonation cookie is httpOnly, so a
   * local copy would be a second source of truth that disagrees after a reload.
   */
  protected readonly currentLocationId = computed(
    () => this.impersonation.current()?.locationId ?? null,
  );

  protected readonly countLabel = computed(() => plural(this.tenants().length, 'client'));

  /**
   * Names the shortfall out loud. "3 clients could not be loaded" is a fact the
   * reader can act on; a list quietly three items short is not.
   */
  protected readonly unavailableLabel = computed(() => {
    const count = this.unavailableCount();
    const subject = count === 1 ? 'client' : 'clients';
    const verb = count === 1 ? 'is' : 'are';
    return `${count} ${subject} could not be loaded and ${verb} missing from this list. The rest are shown below.`;
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.portfolio.listTenants();

    if (result.error) {
      // Cleared, not kept: an error must never render behind stale rows that
      // look current. Same rule the shared DataTable enforces internally.
      this.tenants.set([]);
      this.unavailableCount.set(0);
      this.canEnter.set(false);
      this.error.set(result.error.message);
      this.loading.set(false);
      return;
    }

    this.tenants.set(result.data.tenants);
    this.unavailableCount.set(result.data.unavailable.count);
    this.canEnter.set(result.data.canEnter);
    this.loading.set(false);
  }

  protected isCurrent(tenant: PortfolioTenant): boolean {
    return this.currentLocationId() === tenant.locationId;
  }

  protected async enter(tenant: PortfolioTenant): Promise<void> {
    if (this.entering() !== null || this.isCurrent(tenant)) return;

    this.entering.set(tenant.locationId);
    this.enterError.set(null);

    // Nothing here is the access decision. The endpoint re-checks the hat,
    // validates the location against the tenant registry, and writes the audit
    // entry before it grants anything.
    const result = await this.impersonation.enter(tenant.locationId);
    this.entering.set(null);

    if (result.error) {
      this.enterError.set(result.error.message);
      return;
    }

    try {
      await this.router.navigateByUrl(workspaceUrl(tenant.locationId));
    } catch (cause) {
      // The entry landed and the session already reflects it, so this is a
      // missing destination, not a refused action. Logged rather than shown:
      // the card now reads "You are in this client", which is true.
      console.error('[portfolio] Entered the tenant but the workspace route did not match:', cause);
    }
  }
}

function plural(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}
