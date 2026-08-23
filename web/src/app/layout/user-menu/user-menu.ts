import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { RBAC_SERVICE } from '../../core/services/rbac.service';
import { HAT_LABELS, type Role } from '../../core/models/role.model';

/**
 * The account menu, and the only way to sign out.
 *
 * Story 10.9. `AuthService.signOut()` has existed since the auth port and was
 * called by nothing: no button, no menu, no link. The only exits were clearing
 * cookies by hand or a fetch from a console.
 *
 * That matters more than a missing button usually would. Custom claims are
 * baked into the session cookie when it is minted, so a grant change is
 * invisible until the holder signs out and back in. Without this, an admin can
 * change someone's access and that person has no way to pick it up.
 */
@Component({
  selector: 'app-user-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatDividerModule, RouterLink],
  templateUrl: './user-menu.html',
  styleUrl: './user-menu.scss',
})
export class UserMenu {
  private readonly rbac = inject(RBAC_SERVICE);
  private readonly router = inject(Router);

  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly session = this.rbac.session;

  protected readonly email = computed(() => this.session()?.email ?? '');

  /**
   * TEMPORARY — deleted by story 15.D along with switchRole and
   * POST /api/session/role.
   *
   * Epic 15 removes the active-role concept: a person becomes the set of grants
   * they hold rather than one hat at a time, so there is nothing left to pick.
   * This exists because the endpoint has no UI today, which leaves anyone
   * holding several grants pinned to whichever one sorts first — `admin` for a
   * full grant set, which has no widgets by design.
   *
   * Kept in one block on purpose so 15.D removes a contiguous piece.
   */
  protected readonly otherRoles = computed<Role[]>(() => {
    const s = this.session();
    if (!s) return [];
    // One grant is every real user today; showing a switcher with a single
    // option is noise.
    if (s.availableRoles.length < 2) return [];
    return s.availableRoles.filter((r) => r !== s.currentRole);
  });

  protected readonly currentRoleLabel = computed(() => {
    const role = this.session()?.currentRole;
    return role ? HAT_LABELS[role] : '';
  });

  protected label(role: Role): string {
    return HAT_LABELS[role];
  }

  /** TEMPORARY — see otherRoles. Deleted by 15.D. */
  protected async switchTo(role: Role): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);

    const result = await this.rbac.switchRole(role);
    this.busy.set(false);

    if (result.error) {
      this.error.set(result.error.message);
      return;
    }
    // A hat change rewrites what every screen may show, so re-enter the
    // dashboard rather than leaving the current view half-authorised.
    await this.router.navigateByUrl('/dashboard');
  }

  /**
   * Sign-out must not fail quietly. POST /api/auth/signout is behind the CSRF
   * origin guard, which answers 403 to anything without a matching Origin, and
   * a swallowed 403 leaves someone believing they signed out when they did not.
   * That is the worst outcome available here, so the failure is surfaced and
   * the user stays put.
   */
  protected async signOut(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);

    try {
      await this.rbac.signOut();
    } catch {
      this.busy.set(false);
      this.error.set('Could not sign out. You are still signed in.');
      return;
    }

    this.busy.set(false);
    await this.router.navigateByUrl('/signin');
  }
}
