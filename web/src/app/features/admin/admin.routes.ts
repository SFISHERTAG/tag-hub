import type { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
import { ROLES } from '../../core/models/role.model';

/**
 * Administration is one hat, and it is the one that hands out every other hat.
 *
 * Declared once here and applied to each child rather than to the parent alone.
 * `permissionGuard` reads `data.permission` off the route it is attached to and
 * is default-deny, so a child that inherited nothing would be refused — and,
 * more to the point, a future child added without a permission list should be
 * refused rather than published.
 *
 * Cosmetic, as always: every endpoint under /api/admin re-checks ROLES.ADMIN
 * server-side through `requireApiRole`. A caller who reaches these screens some
 * other way still gets a 403 from the API.
 */
export const ADMIN_ROLES = [ROLES.ADMIN] as const;

const adminChild = { canActivate: [permissionGuard], data: { permission: ADMIN_ROLES } };

export const routes: Routes = [
  {
    path: '',
    ...adminChild,
    loadComponent: () => import('./admin-home/admin-home').then((m) => m.AdminHome),
  },
  {
    path: 'users',
    ...adminChild,
    loadComponent: () => import('./users/admin-users-page').then((m) => m.AdminUsersPage),
  },
  {
    path: 'tenants',
    ...adminChild,
    loadComponent: () => import('./tenants/admin-tenants-page').then((m) => m.AdminTenantsPage),
  },
  {
    // A location with no tenant document yet is reached by typing its id into
    // the list screen's "add tenant" field, which navigates here. The endpoint
    // returns fail-closed defaults plus `exists: false`, and saving creates the
    // document — so this one route covers both editing and creating.
    path: 'tenants/:locationId',
    ...adminChild,
    loadComponent: () =>
      import('./tenants/tenant-detail/tenant-detail').then((m) => m.TenantDetail),
  },
  {
    path: 'courses',
    ...adminChild,
    loadComponent: () => import('./courses/admin-courses-page').then((m) => m.AdminCoursesPage),
  },
  {
    path: 'courses/:courseId',
    ...adminChild,
    loadComponent: () =>
      import('./courses/course-editor/course-editor').then((m) => m.CourseEditor),
  },
  {
    path: 'knowledge-base',
    ...adminChild,
    loadComponent: () =>
      import('./knowledge-base/admin-knowledge-base-page').then((m) => m.AdminKnowledgeBasePage),
  },
  {
    path: 'knowledge-base/:pageId',
    ...adminChild,
    loadComponent: () =>
      import('./knowledge-base/manual-page-editor/manual-page-editor').then(
        (m) => m.ManualPageEditor,
      ),
  },
];
