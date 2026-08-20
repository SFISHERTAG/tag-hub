import { InjectionToken } from '@angular/core';

/**
 * Frontend configuration, injected rather than imported.
 *
 * Components and services take `APP_CONFIG` so a test can supply its own values
 * without touching the file-replacement machinery, and so a stray
 * `import { environment }` deep in a component cannot quietly bypass validation.
 * The environment files are the *source* of these values; this token is the only
 * supported way to *read* them.
 *
 * CLAUDE.md's rule that config is validated at startup applies here as much as
 * it does on the server. The backend half of that rule (`lib/config.ts`) does
 * not exist yet and is tracked separately; this is the frontend half.
 */
export interface AppConfig {
  /** True in a production build. Drives nothing security-relevant on its own. */
  readonly production: boolean;
  /**
   * Prefix for API calls. Empty means same-origin, which is the intended
   * topology — the httpOnly SameSite=lax session cookie only travels to the
   * origin that set it.
   */
  readonly apiBaseUrl: string;
  /**
   * Google Identity Services client id. Empty is legitimate and means Google
   * sign-in is not configured: the button is not rendered and the screen is
   * OTP-only. Public by design — it ships in the bundle and identifies the app
   * rather than authorising anything.
   */
  readonly googleClientId: string;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');
