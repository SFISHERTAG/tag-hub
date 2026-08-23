import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { BreakpointObserver, type BreakpointState } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { Shell } from './shell';
import { RBAC_SERVICE, type RbacService } from '../../core/services/rbac.service';
import { ROLES, type Role } from '../../core/models/role.model';
import type { Session } from '../../core/models/session.model';

/**
 * Story: CLAUDE.md requires "one responsive shell, not two separate layouts",
 * same component tree, breakpoint-driven. The failure this guards against is
 * the easy one: rendering both navigations at once at some width, or neither,
 * which is what happens when the two halves drift into independent conditions.
 *
 * The breakpoint is 840px, and these tests assert the two sides are mutually
 * exclusive rather than merely present.
 */

function session(currentRole: Role): Session {
  return {
    uid: 'u-1',
    email: 'u@example.com',
    currentRole,
    availableRoles: [currentRole],
    locations: [],
    impersonation: null,
  };
}

function setup(matches: boolean, role: Role = ROLES.TAG_EXEC) {
  // Reset first: several tests below render the shell at both widths, and
  // TestBed refuses to be reconfigured once a component has been created.
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [Shell],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      {
        provide: RBAC_SERVICE,
        useValue: {
          session: signal(session(role)).asReadonly(),
          load: () => Promise.resolve(),
          exitImpersonation: () => Promise.resolve({ data: null, error: null }) as never,
          signOut: () => Promise.resolve(),
          switchRole: () =>
            Promise.resolve({ data: null, error: { message: 'stub', context: 'test' } }),
          applySession: () => undefined,
        } satisfies RbacService,
      },
      {
        provide: BreakpointObserver,
        useValue: {
          observe: () => of({ matches, breakpoints: {} } as BreakpointState),
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(Shell);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Shell', () => {
  it('shows the toolbar at every width', () => {
    expect(setup(true).querySelector('mat-toolbar')).not.toBeNull();
    expect(setup(false).querySelector('mat-toolbar')).not.toBeNull();
  });

  it('uses the side rail when wide', () => {
    const host = setup(true);

    expect(host.querySelector('mat-sidenav')).not.toBeNull();
    expect(host.querySelector('.bottom-nav')).toBeNull();
  });

  it('uses the bottom nav when narrow', () => {
    const host = setup(false);

    expect(host.querySelector('.bottom-nav')).not.toBeNull();
    expect(host.querySelector('mat-sidenav')).toBeNull();
  });

  it('never renders both navigations at once', () => {
    for (const wide of [true, false]) {
      const host = setup(wide);
      const both =
        host.querySelector('mat-sidenav') !== null && host.querySelector('.bottom-nav') !== null;

      // Duplicate nav is the specific defect the single-tree requirement exists
      // to prevent, and it looks fine in a desktop browser.
      expect(both).toBe(false);
    }
  });

  it('renders the same nav items either way', () => {
    // Plain anchors: routerLink is a directive binding, not a rendered
    // attribute, so selecting on it matches nothing in the DOM.
    const wide = setup(true).querySelectorAll('a').length;
    const narrow = setup(false).querySelectorAll('a').length;

    // One item list, two presentations. Diverging counts mean the two halves
    // have been given separate sources.
    expect(wide).toBeGreaterThan(0);
    expect(wide).toBe(narrow);
  });

  it('provides an outlet for child feature routes', () => {
    // Feature modules are children of this route, so losing the outlet would
    // leave every ported screen rendering nothing.
    expect(setup(true).querySelector('router-outlet')).not.toBeNull();
  });

  it('gives tag_csd a nav set rather than an empty bar', () => {
    const host = setup(false, ROLES.TAG_CSD);

    // The bug this fixes: in the Next app's nav, tag_csd matched zero entries,
    // so a CS Director signed in to an empty tab bar and the team_health_rollup
    // widget built for them was unreachable.
    expect(host.querySelectorAll('a').length).toBeGreaterThan(0);
    expect(host.textContent).toContain('Portfolio');
    expect(host.textContent).toContain('Clients');
  });

  it('shows Admin to an admin', () => {
    expect(setup(true, ROLES.ADMIN).textContent).toContain('Admin');
  });

  it('hides Admin from everyone else', () => {
    // Cosmetic by contract: the route guard is what actually refuses entry.
    expect(setup(true, ROLES.CLIENT_CLOSER).textContent).not.toContain('Admin');
    expect(setup(true, ROLES.TAG_CSM).textContent).not.toContain('Admin');
  });

  it('gates the two presentations from the same list', () => {
    // One source, two renderings. If these diverge, the nav has grown a second
    // list and the single-tree requirement is no longer true.
    const wide = setup(true, ROLES.TAG_CSD).querySelectorAll('a').length;
    const narrow = setup(false, ROLES.TAG_CSD).querySelectorAll('a').length;

    expect(wide).toBe(narrow);
  });

  it('shows a client role only what it should see', () => {
    const host = setup(false, ROLES.CLIENT_CLOSER);

    expect(host.textContent).toContain('Dashboard');
    expect(host.textContent).toContain('FLOW');
    expect(host.textContent).not.toContain('Portfolio');
    expect(host.textContent).not.toContain('Onboarding');
  });
});
