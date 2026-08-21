import type { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
import { ROLE_LIST } from '../../core/models/role.model';

/**
 * Training is not role-gated. Every signed-in hat has onboarding to do, and the
 * endpoints agree: `GET /api/courses` checks authentication and nothing else.
 *
 * `ROLE_LIST` rather than thirteen hand-written entries. A role added to
 * `ROLES` is a role with onboarding, and a hand-copied list is one that goes
 * stale the first time one is added. Still ROLES.*, never a string literal.
 *
 * NOT `PUBLIC_ROUTE`: that marker exempts a route from authGuard as well, which
 * would publish the catalogue to signed-out visitors. The API would refuse
 * them, so the result would be a permanent error page rather than a leak — but
 * a route that exists only to fail is not a route.
 */
export const COURSE_ROLES = ROLE_LIST;

export const routes: Routes = [
  {
    path: '',
    canActivate: [permissionGuard],
    data: { permission: COURSE_ROLES },
    loadComponent: () => import('./course-list/course-list').then((m) => m.CourseList),
  },
  {
    path: ':courseId',
    canActivate: [permissionGuard],
    data: { permission: COURSE_ROLES },
    loadComponent: () => import('./course-player/course-player').then((m) => m.CoursePlayer),
  },
];
