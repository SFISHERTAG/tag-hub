import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { UserMenu } from './user-menu';
import { RBAC_SERVICE } from '../../core/services/rbac.service';
import { ROLES } from '../../core/models/role.model';
import type { Session } from '../../core/models/session.model';

/**
 * Story 10.9. The behaviour worth pinning is the failure path: sign-out posts
 * through the CSRF origin guard, which answers 403 to anything without a
 * matching Origin. A swallowed 403 leaves someone believing they signed out
 * when they did not, which is the worst outcome this component can produce.
 */

function session(overrides: Partial<Session> = {}): Session {
  return {
    uid: 'u1',
    email: 'sam@test',
    currentRole: ROLES.TAG_CSD,
    availableRoles: [ROLES.TAG_CSD],
    locations: [],
    ...overrides,
  } as Session;
}

function setup(opts: { session?: Session | null; signOut?: () => Promise<void> } = {}) {
  const signOut = opts.signOut ?? (() => Promise.resolve());
  const switchRole = vi.fn(async () => ({ data: session(), error: null }));
  TestBed.configureTestingModule({
    imports: [UserMenu],
    providers: [
      provideRouter([]),
      {
        provide: RBAC_SERVICE,
        useValue: { session: signal(opts.session ?? session()), switchRole, signOut },
      },
    ],
  });
  const fixture = TestBed.createComponent(UserMenu);
  fixture.detectChanges();
  return { fixture, switchRole };
}

describe('UserMenu', () => {
  it('shows the signed-in address', () => {
    const { fixture } = setup();
    const trigger: HTMLElement = fixture.nativeElement.querySelector('.user-menu__trigger');
    expect(trigger.getAttribute('aria-label')).toContain('sam@test');
  });

  it('signs out and lands on /signin', async () => {
    let called = false;
    const { fixture } = setup({ signOut: async () => { called = true; } });
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await (fixture.componentInstance as unknown as { signOut(): Promise<void> }).signOut();

    expect(called).toBe(true);
    expect(nav).toHaveBeenCalledWith('/signin');
  });

  it('surfaces a failed sign-out instead of pretending it worked', async () => {
    const { fixture } = setup({ signOut: () => Promise.reject(new Error('403')) });
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const cmp = fixture.componentInstance as unknown as {
      signOut(): Promise<void>;
      error(): string | null;
    };
    await cmp.signOut();

    expect(cmp.error()).toContain('still signed in');
    // The critical half: no navigation, so the user is not shown a signed-out
    // screen while their cookie is intact.
    expect(nav).not.toHaveBeenCalled();
  });

  /** TEMPORARY — this block goes with the switcher in story 15.D. */
  describe('hat switcher (temporary, deleted by 15.D)', () => {
    it('renders nothing for a single-grant user, which is everyone today', () => {
      const { fixture } = setup();
      const cmp = fixture.componentInstance as unknown as { otherRoles(): string[] };
      expect(cmp.otherRoles()).toEqual([]);
    });

    it('offers the other grants, never the current one', () => {
      const { fixture } = setup({
        session: session({
          currentRole: ROLES.ADMIN,
          availableRoles: [ROLES.ADMIN, ROLES.TAG_EXEC, ROLES.TAG_CSD],
        }),
      });
      const cmp = fixture.componentInstance as unknown as { otherRoles(): string[] };
      expect(cmp.otherRoles()).toEqual([ROLES.TAG_EXEC, ROLES.TAG_CSD]);
    });
  });
});
