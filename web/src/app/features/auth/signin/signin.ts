import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../services/auth.service';
import { GoogleButton } from '../google-button/google-button';
import { APP_CONFIG } from '../../../core/config/app-config';
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
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    GoogleButton,
  ],
  templateUrl: './signin.html',
  styleUrl: './signin.scss',
})
export class Signin {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly config = inject(APP_CONFIG);

  /** Google sign-in renders only when an OAuth client id is configured. */
  protected readonly googleEnabled = this.config.googleClientId !== '';

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

  protected readonly canResend = computed(() => !this.pending() && this.cooldownSeconds() === 0);

  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Navigating away mid-countdown would otherwise leave the interval running
    // against a destroyed component.
    inject(DestroyRef).onDestroy(() => this.stopCooldown());
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

  protected async signInWithGoogle(credential: string): Promise<void> {
    this.pending.set(true);
    this.error.set(null);

    const result = await this.auth.signInWithGoogle(credential);

    if (result.error) {
      this.pending.set(false);
      this.error.set(result.error.message);
      return;
    }

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
