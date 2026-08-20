import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { Signin } from './signin';
import { AuthService } from '../services/auth.service';
import { ok } from '../../../core/models/api-result.model';
import type { Session } from '../../../core/models/session.model';
import { ROLES } from '../../../core/models/role.model';

/**
 * Story: two behaviours here are security-relevant rather than cosmetic.
 *
 * The screen must not reveal whether an address has an account. There is no
 * self-signup, so a form that said "no such user" would let anyone enumerate
 * TAG's client list. It advances to the code step either way.
 *
 * And the `next` destination must be sanitised. authGuard writes the attempted
 * URL there, and following it unchecked is an open redirect on the one page
 * where a victim is most primed to re-enter credentials.
 */

const requestCode = vi.fn();
const verifyCode = vi.fn();

function session(): Session {
  return {
    uid: 'u-1',
    email: 'someone@taxadvisorygrowth.net',
    currentRole: ROLES.TAG_CSM,
    availableRoles: [ROLES.TAG_CSM],
    locations: [],
    impersonation: null,
  };
}

function setup(next: string | null = null) {
  const navigateByUrl = vi.fn().mockResolvedValue(true);

  TestBed.configureTestingModule({
    imports: [Signin],
    providers: [
      // No provideNoopAnimations: @angular/animations is not installed, because
      // Material 22 dropped that peer dependency. Adding the package purely to
      // satisfy a test provider would be the wrong direction.
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: AuthService, useValue: { requestCode, verifyCode } },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            queryParamMap: convertToParamMap(next === null ? {} : { next }),
          },
        },
      },
    ],
  });

  TestBed.inject(Router).navigateByUrl = navigateByUrl;

  const fixture = TestBed.createComponent(Signin);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, navigateByUrl };
}

/** The component's members are protected; tests reach them the same way the template does. */
function view(component: Signin) {
  return component as unknown as {
    step: () => string;
    email: { set: (v: string) => void };
    code: { set: (v: string) => void };
    error: () => string | null;
    cooldownSeconds: () => number;
    submitEmail: () => Promise<void>;
    submitCode: () => Promise<void>;
    backToEmail: () => void;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  requestCode.mockResolvedValue(ok({ ok: true }));
  verifyCode.mockResolvedValue(ok(session()));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Signin', () => {
  it('starts on the email step', () => {
    const { component } = setup();

    expect(view(component).step()).toBe('email');
  });

  it('advances to the code step after requesting', async () => {
    const { component } = setup();
    const v = view(component);
    v.email.set('someone@taxadvisorygrowth.net');

    await v.submitEmail();

    expect(requestCode).toHaveBeenCalledWith('someone@taxadvisorygrowth.net');
    expect(v.step()).toBe('code');
  });

  it('advances even when the address has no account', async () => {
    // The endpoint answers 200 for an unknown address on purpose, and the
    // screen must not undo that by behaving differently.
    const { component } = setup();
    const v = view(component);
    v.email.set('stranger@example.com');

    await v.submitEmail();

    expect(v.step()).toBe('code');
    expect(v.error()).toBeNull();
  });

  it('advances and starts a countdown when a resend is refused', async () => {
    requestCode.mockResolvedValue(ok({ ok: true, cooldown: true, retryAfterSeconds: 42 }));
    const { component } = setup();
    const v = view(component);
    v.email.set('someone@taxadvisorygrowth.net');

    await v.submitEmail();

    // Indistinguishable from a delivered code, which is the point.
    expect(v.step()).toBe('code');
    expect(v.cooldownSeconds()).toBe(42);
  });

  it('shows the server message when a code is wrong', async () => {
    verifyCode.mockResolvedValue({
      data: null,
      error: { message: 'That code is not right.', context: 'x', status: 401 },
    });
    const { component } = setup();
    const v = view(component);
    v.email.set('someone@taxadvisorygrowth.net');
    await v.submitEmail();
    v.code.set('000000');

    await v.submitCode();

    // Reads `message` off the ApiError. The old `{ error }` shape would have
    // surfaced "Http failure response ... 401 Unauthorized" to someone who
    // simply mistyped a digit.
    expect(v.error()).toBe('That code is not right.');
    expect(v.step()).toBe('code');
  });

  it('navigates to a safe next destination on success', async () => {
    const { component, navigateByUrl } = setup('/l/loc1/pipeline');
    const v = view(component);
    v.email.set('someone@taxadvisorygrowth.net');
    await v.submitEmail();
    v.code.set('123456');

    await v.submitCode();

    expect(navigateByUrl).toHaveBeenCalledWith('/l/loc1/pipeline');
  });

  it('refuses an off-site next destination', async () => {
    const { component, navigateByUrl } = setup('https://evil.example.com');
    const v = view(component);
    v.email.set('someone@taxadvisorygrowth.net');
    await v.submitEmail();
    v.code.set('123456');

    await v.submitCode();

    // The open redirect this guards against.
    expect(navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('does not submit a code of the wrong length', async () => {
    const { component } = setup();
    const v = view(component);
    v.email.set('someone@taxadvisorygrowth.net');
    await v.submitEmail();
    v.code.set('123');

    await v.submitCode();

    expect(verifyCode).not.toHaveBeenCalled();
  });

  it('returns to the email step and clears the code', async () => {
    const { component } = setup();
    const v = view(component);
    v.email.set('someone@taxadvisorygrowth.net');
    await v.submitEmail();
    v.code.set('123456');

    v.backToEmail();

    expect(v.step()).toBe('email');
    expect(v.cooldownSeconds()).toBe(0);
  });
});
