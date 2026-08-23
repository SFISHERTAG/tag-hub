import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RBAC_SERVICE } from '../../core/services/rbac.service';

/**
 * Says, permanently and unmissably, that you are inside someone else's tenant.
 *
 * Story 10.3, porting 3.4. The banner is not decoration: entering a client
 * tenant writes an audit entry against the actor (3.5), and everything done
 * while it is showing is attributed to them acting as that client. Somebody who
 * has forgotten they are impersonating will read a client's numbers as TAG's,
 * or worse, act on them.
 *
 * It renders from `session.impersonation`, which arrives on every session
 * response rather than being fetched separately. The `hub_impersonation` cookie
 * is httpOnly, so a client-side read is impossible and a separately-fetched
 * banner would vanish on reload while the access it describes stayed live.
 */
@Component({
  selector: 'app-impersonation-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './impersonation-banner.html',
  styleUrl: './impersonation-banner.scss',
})
export class ImpersonationBanner {
  private readonly rbac = inject(RBAC_SERVICE);
  private readonly router = inject(Router);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly locationId = computed(
    () => this.rbac.session()?.impersonation?.locationId ?? null,
  );

  /**
   * Leaving must not fail quietly. A banner that disappears while the cookie
   * survives is worse than no banner: it states the opposite of the truth, and
   * the next action is still attributed to the impersonated tenant.
   */
  protected async exit(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);

    const result = await this.rbac.exitImpersonation();
    this.busy.set(false);

    if (result.error) {
      this.error.set(result.error.message);
      return;
    }
    await this.router.navigateByUrl('/portfolio');
  }
}
