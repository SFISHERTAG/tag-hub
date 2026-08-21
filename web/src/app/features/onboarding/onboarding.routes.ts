import type { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
import { ROLES } from '../../core/models/role.model';

/**
 * TAG exec and CSM. Matches `ONBOARDING_ROLES` in app/api/onboarding/_launch.ts
 * exactly, which is the gate that actually decides.
 *
 * Narrower than the legacy `markTaskComplete` action, which allowed any
 * non-client role via `isClientUser` — a helper that names only three of the
 * five client roles and so reported a client's setter as internal. The positive
 * allowlist fails in the safe direction.
 *
 * Also narrower than the current `/onboarding` nav entry, which additionally
 * lists TAG_CSD. That entry is wider than both this guard and the API, so a CS
 * Director clicking it today would be bounced. Flagged in the report for
 * whoever owns nav-items.ts rather than widened here: if a CSD should have
 * onboarding, the endpoint has to say so first.
 */
export const ONBOARDING_ROLES = [ROLES.TAG_EXEC, ROLES.TAG_CSM] as const;

export const routes: Routes = [
  {
    path: '',
    canActivate: [permissionGuard],
    data: { permission: ONBOARDING_ROLES },
    loadComponent: () =>
      import('./checklist/onboarding-checklist').then((m) => m.OnboardingChecklist),
  },
  {
    // The whole launch flow — form, review, create, activate — is one component.
    // Three routes carrying state in the query string is how the Next version
    // did it, and it is why "confirm" and "activate" ended up looking like the
    // same step: each page had to re-derive what the previous one had done.
    path: 'launch',
    canActivate: [permissionGuard],
    data: { permission: ONBOARDING_ROLES },
    loadComponent: () => import('./launch/campaign-launch').then((m) => m.CampaignLaunch),
  },
  {
    // Deep link to one client's checklist, for a link out of Portfolio or a
    // rollup. Declared AFTER `launch` so the static segment wins.
    path: ':locationId',
    canActivate: [permissionGuard],
    data: { permission: ONBOARDING_ROLES },
    loadComponent: () =>
      import('./checklist/onboarding-checklist').then((m) => m.OnboardingChecklist),
  },
];
