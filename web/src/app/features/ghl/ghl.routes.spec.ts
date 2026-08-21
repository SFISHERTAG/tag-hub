import { locationAccessGuard } from '../../core/guards/location-access.guard';
import { permissionGuard } from '../../core/guards/permission.guard';
import { ROLE_LIST, type Role } from '../../core/models/role.model';
import { GHL_WORKSPACE_ROLES, routes } from './ghl.routes';
import type { Route } from '@angular/router';

/**
 * Story: permissionGuard is default-deny, so a route that forgets its
 * permission list is refused rather than published. That is the safe failure,
 * but it fails in a way only the person who wrote the route notices — they test
 * it under a hat that happens to pass. These tests are the other half.
 *
 * The workspace route must also carry locationAccessGuard. Without it, typing
 * another tenant's id into the URL renders a whole shell of empty panels and a
 * stack of 403s, which reads as an outage rather than as a refusal. It is
 * cosmetic either way — the endpoints decide — but a screen that exists only to
 * fail is not a screen.
 */

function children(): Route[] {
  return routes[0].children ?? [];
}

describe('ghl.routes', () => {
  it('guards the workspace on both the hat and the tenant', () => {
    expect(routes[0].path).toBe(':locationId');
    expect(routes[0].canActivate).toContain(permissionGuard);
    expect(routes[0].canActivate).toContain(locationAccessGuard);
  });

  it('opens on the pipeline, as the portfolio screen expects', () => {
    // features/portfolio navigates to /l/{id}/pipeline after entering a
    // tenant; the bare /l/{id} has to land somewhere real too.
    const index = children().find((route) => route.path === '');
    expect(index?.redirectTo).toBe('pipeline');
    expect(index?.pathMatch).toBe('full');
  });

  it('declares every screen the story promised', () => {
    const paths = children().map((route) => route.path);
    expect(paths).toEqual([
      '',
      'pipeline',
      'today',
      'contacts',
      'contacts/:contactId',
      'follow-up',
    ]);
  });

  it('gives every screen its own permission list', () => {
    for (const route of children()) {
      if (route.redirectTo !== undefined) continue;
      const permission = route.data?.['permission'] as readonly Role[] | undefined;
      expect(route.canActivate).toContain(permissionGuard);
      expect(permission).toBeDefined();
      expect(permission?.length).toBeGreaterThan(0);
    }
  });

  it('names only real roles', () => {
    // Never a bare string: a typo'd role silently matches nobody, and a route
    // that matches nobody looks exactly like a route that is working.
    for (const role of GHL_WORKSPACE_ROLES) {
      expect(ROLE_LIST).toContain(role);
    }
  });

  it('admits the hats that can actually reach a client tenant', () => {
    const roles: readonly string[] = GHL_WORKSPACE_ROLES;

    // The five client hats work inside their own tenant.
    expect(roles).toContain('client_owner');
    expect(roles).toContain('client_manager');
    expect(roles).toContain('client_closer');
    // The internal hats that reach one: all-access, plus a CSM by impersonation.
    expect(roles).toContain('tag_exec');
    expect(roles).toContain('tag_csd');
    expect(roles).toContain('tag_csm');
    // Portfolio's "Enter" already routes a sales manager here.
    expect(roles).toContain('tag_sales_manager');
  });
});
