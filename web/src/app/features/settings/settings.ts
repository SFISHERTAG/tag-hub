import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { RBAC_SERVICE } from '../../core/services/rbac.service';
import { HAT_LABELS, type Role } from '../../core/models/role.model';

/**
 * Account settings.
 *
 * Story 10.9. Deliberately thin: the user menu needed somewhere real to send
 * "Settings", and `nav-items.ts` is explicit that a link its guard refuses
 * "sends people into a redirect". A stub page beats an inert menu item.
 *
 * What it does show is not filler. The roles a session actually holds were
 * unreadable from inside the product — the only way to find out was to read
 * custom claims with the Admin SDK. Not knowing them cost real time this week,
 * twice.
 */
@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatChipsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  private readonly rbac = inject(RBAC_SERVICE);

  protected readonly session = this.rbac.session;
  protected readonly email = computed(() => this.session()?.email ?? 'Not signed in');
  protected readonly roles = computed<Role[]>(() => this.session()?.availableRoles ?? []);
  protected readonly current = computed(() => this.session()?.currentRole ?? null);

  protected label(role: Role): string {
    return HAT_LABELS[role];
  }
}
