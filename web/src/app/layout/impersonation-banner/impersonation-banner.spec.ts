import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ImpersonationBanner } from './impersonation-banner';
import { RBAC_SERVICE } from '../../core/services/rbac.service';
import { ROLES } from '../../core/models/role.model';
import type { Session } from '../../core/models/session.model';

/**
 * Story 10.3, porting 3.4.
 *
 * The behaviour worth pinning is the failure path. A banner that disappears
 * while the impersonation cookie survives states the opposite of the truth, and
 * every action after it is still attributed to the impersonated tenant. That is
 * strictly worse than showing no banner at all.
 */

function session(impersonation: { locationId: string } | null): Session {
  return {
    uid: 'u1',
    email: 'csm@test',
    currentRole: ROLES.TAG_CSM,
    availableRoles: [ROLES.TAG_CSM],
    locations: ['loc-a'],
    impersonation,
  };
}

function setup(impersonation: { locationId: string } | null, exitResult?: unknown) {
  const exitImpersonation = vi.fn(
    async () => exitResult ?? { data: session(null), error: null },
  );
  TestBed.configureTestingModule({
    imports: [ImpersonationBanner],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      {
        provide: RBAC_SERVICE,
        useValue: { session: signal(session(impersonation)), exitImpersonation },
      },
    ],
  });
  const fixture = TestBed.createComponent(ImpersonationBanner);
  fixture.detectChanges();
  return { fixture, exitImpersonation };
}

describe('ImpersonationBanner', () => {
  it('renders nothing when not impersonating', () => {
    const { fixture } = setup(null);
    expect(fixture.nativeElement.querySelector('.impersonation')).toBeNull();
  });

  it('names the tenant being viewed', () => {
    const { fixture } = setup({ locationId: 'loc-xyz' });
    const text: string = fixture.nativeElement.querySelector('.impersonation').textContent;
    expect(text).toContain('loc-xyz');
  });

  it('says actions are recorded, because that is the point of the banner', () => {
    const { fixture } = setup({ locationId: 'loc-xyz' });
    const text: string = fixture.nativeElement.querySelector('.impersonation').textContent;
    expect(text).toContain('recorded against you');
  });

  it('leaves and returns to the portfolio', async () => {
    const { fixture, exitImpersonation } = setup({ locationId: 'loc-xyz' });
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await (fixture.componentInstance as unknown as { exit(): Promise<void> }).exit();

    expect(exitImpersonation).toHaveBeenCalled();
    expect(nav).toHaveBeenCalledWith('/portfolio');
  });

  it('stays put and says so when leaving fails', async () => {
    const { fixture } = setup(
      { locationId: 'loc-xyz' },
      { data: null, error: { message: 'Could not exit.', context: 'test' } },
    );
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    const cmp = fixture.componentInstance as unknown as {
      exit(): Promise<void>;
      error(): string | null;
    };
    await cmp.exit();

    expect(cmp.error()).toContain('Could not exit.');
    // The critical half: no navigation. Moving away would imply the
    // impersonation ended when the cookie is still live.
    expect(nav).not.toHaveBeenCalled();
  });
});
