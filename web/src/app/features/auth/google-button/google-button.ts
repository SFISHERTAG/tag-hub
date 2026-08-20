import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
  afterNextRender,
} from '@angular/core';
import { APP_CONFIG } from '../../../core/config/app-config';
import type {
  GoogleCredentialResponse,
  WindowWithGoogle,
} from './gis.types';

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

/**
 * Wraps Google's rendered sign-in button. Does not reproduce it.
 *
 * CLAUDE.md is explicit that Google sign-in uses the Identity Services rendered
 * button per Google's branding guidelines, and that we wrap rather than reskin.
 * So this component owns the script, the container element and the lifecycle,
 * and Google owns every pixel inside it. There is no Material styling here on
 * purpose, and the host is not styled beyond layout: restyling the button is
 * both a branding violation and the kind of change that silently breaks when
 * Google updates the widget.
 *
 * `theme: 'outline_dark'` is the one visual choice, and it is a value Google
 * supplies for exactly this case: the app's body is true black, and the default
 * light outline would sit on it badly.
 */
@Component({
  selector: 'app-google-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="google-button">
      <div #target></div>
      @if (failed()) {
        <p class="google-button__error" role="alert">
          Google sign-in is unavailable right now. Use a sign-in code instead.
        </p>
      }
    </div>
  `,
  styles: `
    .google-button {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      /* Google caps the rendered button at 400px. */
      max-inline-size: 400px;
      margin-inline: auto;
    }

    .google-button__error {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
      text-align: center;
    }
  `,
})
export class GoogleButton {
  private readonly config = inject(APP_CONFIG);
  private readonly destroyRef = inject(DestroyRef);

  private readonly target = viewChild.required<ElementRef<HTMLElement>>('target');

  /** Emits the encoded ID token for the caller to exchange server-side. */
  readonly credential = output<string>();

  protected readonly failed = signal(false);

  constructor() {
    // afterNextRender rather than a lifecycle hook: the container element has
    // to exist before Google is asked to render into it, and this never runs
    // during server-side rendering, where `document` does not exist.
    afterNextRender(() => void this.render());
  }

  private async render(): Promise<void> {
    // Belt and braces. The parent only renders this component when a client id
    // is configured, but initialising GIS with an empty id fails inside Google's
    // script with an opaque console error rather than anything actionable.
    if (!this.config.googleClientId) {
      this.failed.set(true);
      return;
    }

    try {
      const google = await loadGis(this.destroyRef);

      google.accounts.id.initialize({
        client_id: this.config.googleClientId,
        callback: (response: GoogleCredentialResponse) => {
          this.credential.emit(response.credential);
        },
        ux_mode: 'popup',
        // Opt into the FedCM button UX. Still defaults to false, and its
        // deprecated sibling use_fedcm_for_prompt is ignored, so it is not set.
        use_fedcm_for_button: true,
        // Never sign someone in without them clicking. Auto-select on a shared
        // machine signs in whoever used it last.
        auto_select: false,
        context: 'signin',
      });

      google.accounts.id.renderButton(this.target().nativeElement, {
        type: 'standard',
        theme: 'outline_dark',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 320,
      });
    } catch {
      // A blocked CDN, an offline browser, or a tracking blocker. The OTP flow
      // is unaffected, so this degrades to a note rather than an error state.
      this.failed.set(true);
    }
  }
}

/** Resolves once window.google is available, loading the script if needed. */
let pending: Promise<WindowWithGoogle['google']> | null = null;

function loadGis(destroyRef: DestroyRef): Promise<NonNullable<WindowWithGoogle['google']>> {
  const w = window as WindowWithGoogle;
  if (w.google) return Promise.resolve(w.google);

  // Shared across instances: two buttons on one page must not append the script
  // twice, and a component destroyed mid-load must not leave the next one
  // waiting on a promise nobody will settle.
  pending ??= new Promise<WindowWithGoogle['google']>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SCRIPT_SRC}"]`,
    );
    const script = existing ?? document.createElement('script');

    script.addEventListener('load', () => resolve((window as WindowWithGoogle).google), {
      once: true,
    });
    script.addEventListener('error', () => reject(new Error('Failed to load GIS')), {
      once: true,
    });

    if (!existing) {
      script.src = GIS_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  const settled = pending.then((google) => {
    if (!google) throw new Error('GIS loaded but window.google is absent');
    return google;
  });

  // Clear the shared handle on failure so a later attempt can retry rather than
  // replaying the same rejection forever.
  settled.catch(() => {
    pending = null;
  });

  destroyRef.onDestroy(() => {
    (window as WindowWithGoogle).google?.accounts.id.cancel();
  });

  return settled;
}
