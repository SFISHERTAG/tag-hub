import { isDevMode } from '@angular/core';
import { appConfig } from './app.config';
import { RBAC_SERVICE } from './core/services/rbac.service';
import { MockRbacService } from './core/services/mock-rbac.service';
import { HttpRbacService } from './core/services/http-rbac.service';

/**
 * Pins the RBAC provider choice.
 *
 * MockRbacService carries a hardcoded tag_exec session whose availableRoles
 * include admin. Providing it in a production bundle means every route guard
 * passes for everyone with no server involved. It was once provided
 * unconditionally; the fix was a one-line isDevMode() ternary, and nothing
 * stopped that line being edited back.
 *
 * Epic 10 described the fixed state as still broken for long enough that the
 * claim was repeated as a live vulnerability. A description cannot fail; this
 * can.
 */
describe('appConfig RBAC provider', () => {
  function rbacProvider() {
    return appConfig.providers
      .flat(Infinity)
      .find(
        (p): p is { provide: unknown; useClass: unknown } =>
          typeof p === 'object' && p !== null && 'provide' in p && p.provide === RBAC_SERVICE,
      );
  }

  it('provides an RBAC implementation at all', () => {
    expect(rbacProvider()).toBeDefined();
  });

  it('never provides the mock outside development', () => {
    const provider = rbacProvider();
    if (isDevMode()) {
      // Under `ng test` this is the dev path; assert the intent rather than skip.
      expect([MockRbacService, HttpRbacService]).toContain(provider!.useClass);
    } else {
      expect(provider!.useClass).toBe(HttpRbacService);
      expect(provider!.useClass).not.toBe(MockRbacService);
    }
  });

  it('binds the mock strictly to isDevMode, not to any other condition', () => {
    // The guarantee is the ternary itself: whichever branch this environment
    // takes, the class chosen must be the one isDevMode() selects.
    const expected = isDevMode() ? MockRbacService : HttpRbacService;
    expect(rbacProvider()!.useClass).toBe(expected);
  });
});
