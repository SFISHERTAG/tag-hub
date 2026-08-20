import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { PermissionService } from '../../core/services/permission.service';
import type { Role } from '../../core/models/role.model';

/**
 * Structural directive for UI gating only — per CLAUDE.md, this is cosmetic.
 * The API re-checks every request; a hidden button is never the security
 * control.
 *
 * Usage: <button *hasPermission="[ROLES.TAG_EXEC, ROLES.ADMIN]">...</button>
 *
 * Always ROLES.*, never a bare string. The pre-commit check strips comments
 * before matching, so an inline literal here would pass and then be copied.
 */
@Directive({
  selector: '[hasPermission]',
})
export class HasPermissionDirective {
  private readonly permission = inject(PermissionService);
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private hasView = false;

  readonly hasPermission = input.required<Role | readonly Role[]>();

  constructor() {
    effect(() => {
      const allowed = this.hasPermission();
      const roles = Array.isArray(allowed) ? allowed : [allowed];
      const show = this.permission.hasAnyRole(roles);

      if (show && !this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!show && this.hasView) {
        this.viewContainer.clear();
        this.hasView = false;
      }
    });
  }
}
