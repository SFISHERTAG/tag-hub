import { Injectable, computed, inject } from '@angular/core';
import { RBAC_SERVICE } from './rbac.service';
import type { Role } from '../models/role.model';

/**
 * The one place role checks go through — port of lib/auth/roles.ts's
 * hasAnyRole. Per CLAUDE.md: no role string may appear inline in a
 * component/template/guard, only via ROLES.* + this service.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly rbac = inject(RBAC_SERVICE);

  readonly currentRole = computed(() => this.rbac.session()?.currentRole);

  hasAnyRole(allowed: readonly Role[]): boolean {
    const role = this.currentRole();
    return !!role && allowed.includes(role);
  }
}
