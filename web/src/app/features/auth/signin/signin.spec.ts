import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { Signin } from './signin';
import { AuthService } from '../services/auth.service';
import { ok } from '../../../core/models/api-result.model';
import type { Session } from '../../../core/models/session.model';
import { ROLES } from '../../../core/models/role.model';
import { APP_CONFIG } from '../../../core/config/app-config';

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
const signInWithGoogle = vi.fn();

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

function setup(next: string | null = null, googleClientId = '') {
  const navigateByUrl = vi.fn().mockResolvedValue(true);

  TestBed.configureTestingModule({
    imports: [Signin],
    providers: [
      // No provideNoopAnimations: @angular/animations is not installed, because
      // Material 22 dropped that peer dependency. Adding the package purely to
      // satisfy a test provider would be the wrong direction.
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: AuthService, useValue: { requestCode, verifyCode, signInWithGoogle } },
      {
        provide: APP_CONFIG,
        useValue: { production: false, apiBaseUrl: '', googleClientId },
      },
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
    googleEnabled: boolean;
    signInWithGoogle: (credential: string) => Promise<void>;
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
  signInWithGoogle.mockResolvedValue(ok(session()));
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

  /**
   * The four Google sign-in tests that stood here were removed 2026-08-23 with
   * the button itself. Google is no longer rendered on this screen — a product
   * decision, not a regression: the OTP path is the primary one, and the button
   * was the loudest element on a page whose point is that it says very little.
   *
   * AuthService.signInWithGoogle and the GoogleButton component both remain in
   * the codebase, tested where they live. Only this screen stopped calling them.
   */
});

/**
 * The six-box code entry, added 2026-08-23.
 *
 * These exist because a box-per-digit that only handles typing is worse than
 * the single field it replaced: people paste these codes out of an email far
 * more often than they type them, and a paste that fills one box and drops five
 * digits is a dead end with no error message.
 */
describe('Signin — six-box code entry', () => {
  async function atCodeStep() {
    const ctx = setup();
    const cmp = ctx.fixture.componentInstance as unknown as {
      email: { set(v: string): void };
      submitEmail(): Promise<void>;
      code(): string;
      digitAt(i: number): string;
      onDigitPaste(e: ClipboardEvent): void;
      onDigitInput(i: number, e: Event): void;
      onDigitKeydown(i: number, e: KeyboardEvent): void;
    };
    cmp.email.set('a@test');
    await cmp.submitEmail();
    ctx.fixture.detectChanges();
    return { ...ctx, cmp };
  }

  function pasteEvent(text: string): ClipboardEvent {
    return {
      clipboardData: { getData: () => text },
      preventDefault: () => undefined,
    } as unknown as ClipboardEvent;
  }

  function inputEvent(value: string): Event {
    return { target: { value } } as unknown as Event;
  }

  it('renders one box per digit', async () => {
    const { fixture } = await atCodeStep();
    expect(fixture.nativeElement.querySelectorAll('.door__digit')).toHaveLength(6);
  });

  it('fills every box from a pasted code', async () => {
    const { cmp } = await atCodeStep();
    cmp.onDigitPaste(pasteEvent('123456'));
    expect(cmp.code()).toBe('123456');
  });

  it('strips whatever came along with the paste', async () => {
    const { cmp } = await atCodeStep();
    // Codes get pasted out of an email with spaces, dashes and stray words.
    cmp.onDigitPaste(pasteEvent('Your code is 12 34-56'));
    expect(cmp.code()).toBe('123456');
  });

  it('ignores a paste that carries no digits', async () => {
    const { cmp } = await atCodeStep();
    cmp.onDigitPaste(pasteEvent('no digits here'));
    expect(cmp.code()).toBe('');
  });

  it('takes the last character typed, so a box can be corrected in place', async () => {
    const { cmp } = await atCodeStep();
    cmp.onDigitInput(0, inputEvent('7'));
    // Typing into a box that already holds a digit replaces it rather than
    // being swallowed, which is what it looks like the key should do.
    cmp.onDigitInput(0, inputEvent('79'));
    expect(cmp.digitAt(0)).toBe('9');
  });

  it('refuses a non-digit', async () => {
    const { cmp } = await atCodeStep();
    cmp.onDigitInput(0, inputEvent('a'));
    expect(cmp.digitAt(0)).toBe('');
  });

  it('backspace in an empty box clears the one before it', async () => {
    const { cmp } = await atCodeStep();
    cmp.onDigitPaste(pasteEvent('12'));
    cmp.onDigitKeydown(2, {
      key: 'Backspace',
      preventDefault: () => undefined,
    } as unknown as KeyboardEvent);
    expect(cmp.code()).toBe('1');
  });
});
