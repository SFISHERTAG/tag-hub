import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../services/auth.service';
import { safeNext } from '../services/safe-next';

type Step = 'email' | 'code';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Email address, then a 6-digit code.
 *
 * Two rules this screen exists to honour. It never says whether an address has
 * an account, because there is no self-signup and doing so would let anyone
 * enumerate TAG's client list. And the `next` destination is sanitised before
 * use: authGuard writes the attempted URL there, and following it unchecked
 * would be an open redirect on the one page where a victim is most likely to
 * re-enter credentials.
 */
@Component({
  selector: 'app-signin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
  ],
  templateUrl: './signin.html',
  styleUrl: './signin.scss',
})
export class Signin {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly step = signal<Step>('email');
  protected readonly email = signal('');
  protected readonly code = signal('');
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly cooldownSeconds = signal(0);

  protected readonly codeLength = CODE_LENGTH;

  protected readonly canSubmitEmail = computed(
    () => !this.pending() && this.email().includes('@'),
  );

  protected readonly canSubmitCode = computed(
    () => !this.pending() && this.code().trim().length === CODE_LENGTH,
  );

  /** `[0,1,2,3,4,5]`, so the template can `@for` over the boxes. */
  protected readonly digitIndexes = Array.from({ length: CODE_LENGTH }, (_, i) => i);

  private readonly digitInputs = viewChildren<ElementRef<HTMLInputElement>>('digitInput');

  protected digitAt(index: number): string {
    return this.code()[index] ?? '';
  }

  private setDigit(index: number, value: string): void {
    const chars = this.code().padEnd(CODE_LENGTH, ' ').split('');
    chars[index] = value;
    this.code.set(chars.join('').trimEnd());
  }

  private focusBox(index: number): void {
    this.digitInputs()[index]?.nativeElement.focus();
  }

  /**
   * One box per digit. Everything here exists because a six-box code entry that
   * only handles typing is worse than a single field: people paste these codes
   * out of an email far more often than they type them.
   */
  protected onDigitInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    // Take the LAST character, not the first. Typing into a box that already
    // holds a digit should replace it rather than be ignored.
    const digit = input.value.replace(/\D/g, '').slice(-1);
    input.value = digit;
    this.setDigit(index, digit);
    if (digit && index < CODE_LENGTH - 1) this.focusBox(index + 1);
  }

  protected onDigitKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.digitAt(index) && index > 0) {
      // Backspace in an empty box steps back and clears, which is what the
      // key appears to do when the boxes read as one field.
      event.preventDefault();
      this.setDigit(index - 1, '');
      this.focusBox(index - 1);
      return;
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      this.focusBox(index - 1);
    }
    if (event.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      event.preventDefault();
      this.focusBox(index + 1);
    }
  }

  /** A pasted code fills every box, wherever it was pasted. */
  protected onDigitPaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text')?.replace(/\D/g, '') ?? '';
    if (!pasted) return;
    event.preventDefault();
    this.code.set(pasted.slice(0, CODE_LENGTH));
    this.focusBox(Math.min(pasted.length, CODE_LENGTH - 1));
  }

  protected readonly canResend = computed(() => !this.pending() && this.cooldownSeconds() === 0);

  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Navigating away mid-countdown would otherwise leave the interval running
    // against a destroyed component.
    inject(DestroyRef).onDestroy(() => this.stopCooldown());

    // OTP link from email contains #e=email&c=code. Parse and auto-populate.
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const email = fragment.get('e');
    const code = fragment.get('c');

    if (email) {
      this.email.set(email);
      if (code?.length === CODE_LENGTH) {
        this.code.set(code);
        this.step.set('code');
      }
    }
  }

  protected async submitEmail(): Promise<void> {
    if (!this.canSubmitEmail()) return;
    this.pending.set(true);
    this.error.set(null);

    const result = await this.auth.requestCode(this.email().trim());
    this.pending.set(false);

    if (result.error) {
      this.error.set(result.error.message);
      return;
    }

    // Advance regardless of whether a code was actually issued. A cooldown
    // response and a delivered code look the same on purpose.
    this.step.set('code');
    this.startCooldown(result.data.retryAfterSeconds ?? RESEND_COOLDOWN_SECONDS);
  }

  protected async submitCode(): Promise<void> {
    if (!this.canSubmitCode()) return;
    this.pending.set(true);
    this.error.set(null);

    const result = await this.auth.verifyCode(this.email().trim(), this.code().trim());

    if (result.error) {
      this.pending.set(false);
      this.error.set(result.error.message);
      return;
    }

    // The session cookie is already set and the session already applied, so
    // navigate straight on. Left pending so the form cannot be resubmitted
    // during the transition.
    this.stopCooldown();
    await this.router.navigateByUrl(safeNext(this.route.snapshot.queryParamMap.get('next')));
  }


  protected async resend(): Promise<void> {
    if (!this.canResend()) return;
    await this.submitEmail();
  }

  protected backToEmail(): void {
    this.stopCooldown();
    this.code.set('');
    this.error.set(null);
    this.step.set('email');
  }

  private startCooldown(seconds: number): void {
    this.stopCooldown();
    this.cooldownSeconds.set(seconds);
    this.cooldownTimer = setInterval(() => {
      const remaining = this.cooldownSeconds() - 1;
      this.cooldownSeconds.set(Math.max(0, remaining));
      if (remaining <= 0) this.stopCooldown();
    }, 1000);
  }

  /**
   * Clears the timer AND the displayed count. Stopping only the timer left the
   * last number frozen on screen, so going back to the email step still showed
   * "Resend in 47s" against a countdown that was no longer running.
   */
  private stopCooldown(): void {
    if (this.cooldownTimer !== null) {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    this.cooldownSeconds.set(0);
  }
}
