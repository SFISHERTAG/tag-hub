import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HasPermissionDirective } from './has-permission.directive';
import { PermissionService } from '../../core/services/permission.service';
import { RBAC_SERVICE, type RbacService } from '../../core/services/rbac.service';
import { ROLES, type Role } from '../../core/models/role.model';
import type { Session } from '../../core/models/session.model';

/**
 * Story: this directive is cosmetic by contract. CLAUDE.md is explicit that a
 * hidden button is never a security control and the API re-checks every
 * request, so these tests cover what it is actually responsible for: showing
 * and hiding, and reacting when the wearer switches hats.
 *
 * The hat-switch case is the one worth having. `PermissionService.currentRole`
 * is a computed over a signal, so a directive that read the role once at
 * construction would look correct until someone changed hats and kept seeing
 * the previous role's buttons.
 */

@Component({
  standalone: true,
  imports: [HasPermissionDirective],
  template: `
    <span *hasPermission="single">single</span>
    <span *hasPermission="many">many</span>
  `,
})
class Host {
  single: Role = ROLES.ADMIN;
  many: readonly Role[] = [ROLES.TAG_CSM, ROLES.TAG_EXEC];
}

function setup(initialRole: Role) {
  const session = signal<Session | null>({
    uid: 'u1',
    email: 'u@example.com',
    currentRole: initialRole,
    availableRoles: [initialRole],
    locations: [],
    impersonation: null,
  });

  const rbac: RbacService = {
    session: session.asReadonly(),
    load: () => Promise.resolve(),
    // Sets synchronously before resolving, so a test can switch and then
    // detectChanges() without awaiting.
    switchRole: (role: Role) => {
      const current = session();
      if (current) session.set({ ...current, currentRole: role });
      const next = session();
      return Promise.resolve(
        next ? { data: next, error: null } : { data: null, error: { message: 'no session', context: 'test' } },
      );
    },
    applySession: (value) => session.set(value),
  };

  TestBed.configureTestingModule({
    imports: [Host],
    providers: [{ provide: RBAC_SERVICE, useValue: rbac }, PermissionService],
  });

  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return { fixture, rbac };
}

function rendered(fixture: ReturnType<typeof setup>['fixture']): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('HasPermissionDirective', () => {
  it('renders content for a matching single role', () => {
    const { fixture } = setup(ROLES.ADMIN);

    expect(rendered(fixture)).toContain('single');
  });

  it('hides content for a non-matching single role', () => {
    const { fixture } = setup(ROLES.CLIENT_CLOSER);

    expect(rendered(fixture)).not.toContain('single');
  });

  it('renders when the role is anywhere in a list', () => {
    const { fixture } = setup(ROLES.TAG_EXEC);

    expect(rendered(fixture)).toContain('many');
  });

  it('hides when the role is in no list', () => {
    const { fixture } = setup(ROLES.CLIENT_SETTER);
    const text = rendered(fixture);

    expect(text).not.toContain('single');
    expect(text).not.toContain('many');
  });

  it('reacts when the wearer switches hats', () => {
    const { fixture, rbac } = setup(ROLES.ADMIN);
    expect(rendered(fixture)).toContain('single');
    expect(rendered(fixture)).not.toContain('many');

    rbac.switchRole(ROLES.TAG_CSM);
    fixture.detectChanges();

    // Reading the role once at construction would leave 'single' on screen.
    expect(rendered(fixture)).not.toContain('single');
    expect(rendered(fixture)).toContain('many');
  });

  it('hides everything when there is no session', () => {
    const rbac: RbacService = {
      session: signal(null).asReadonly(),
      load: () => Promise.resolve(),
      switchRole: () =>
        Promise.resolve({ data: null, error: { message: 'stub', context: 'test' } }),
      applySession: () => undefined,
    };
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [{ provide: RBAC_SERVICE, useValue: rbac }, PermissionService],
    });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();

    expect(rendered(fixture)).toBe('');
  });
});

describe('PermissionService', () => {
  it('reports the current role from the session', () => {
    setup(ROLES.TAG_CSD);

    expect(TestBed.inject(PermissionService).currentRole()).toBe(ROLES.TAG_CSD);
  });

  it('denies every check when signed out', () => {
    const rbac: RbacService = {
      session: signal(null).asReadonly(),
      load: () => Promise.resolve(),
      switchRole: () =>
        Promise.resolve({ data: null, error: { message: 'stub', context: 'test' } }),
      applySession: () => undefined,
    };
    TestBed.configureTestingModule({
      providers: [{ provide: RBAC_SERVICE, useValue: rbac }, PermissionService],
    });

    const permission = TestBed.inject(PermissionService);
    expect(permission.currentRole()).toBeUndefined();
    expect(permission.hasAnyRole([ROLES.ADMIN])).toBe(false);
  });

  it('denies an empty allow-list', () => {
    setup(ROLES.TAG_EXEC);

    // Fail closed: an empty list grants nothing, it does not mean "anyone".
    expect(TestBed.inject(PermissionService).hasAnyRole([])).toBe(false);
  });
});
