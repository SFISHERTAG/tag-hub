/**
 * Minimal typings for the Google Identity Services browser library.
 *
 * Hand-written rather than pulled from @types/google.accounts: strict TS forbids
 * `any`, the script is loaded at runtime from Google's CDN so nothing here is
 * bundled, and this app uses four fields of a large API. A narrow local type
 * that describes exactly what we call is easier to audit than a broad one.
 *
 * Field choices worth recording, all verified against the current reference:
 * `use_fedcm_for_prompt` is deprecated and ignored, so it is deliberately absent;
 * `use_fedcm_for_button` still defaults to false and is opt-in.
 */

/** What the callback receives after a successful sign-in. */
export interface GoogleCredentialResponse {
  /** An encoded JWT ID token. Proves identity; grants no API scopes. */
  credential: string;
  /** How the credential was selected, e.g. 'btn', 'fedcm'. */
  select_by?: string;
  /** Echoed back only when the button declared a `state`. */
  state?: string;
}

export interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  /** 'popup' returns to the callback; 'redirect' POSTs to login_uri instead. */
  ux_mode?: 'popup' | 'redirect';
  /** Opt into the FedCM button UX. Defaults to false. */
  use_fedcm_for_button?: boolean;
  auto_select?: boolean;
  context?: 'signin' | 'signup' | 'use';
}

export interface GoogleButtonOptions {
  type: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black' | 'outline_dark';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  /** Minimum width in pixels. Google caps this at 400. */
  width?: number;
  locale?: string;
}

export interface GoogleAccountsId {
  initialize(config: GoogleIdConfiguration): void;
  renderButton(parent: HTMLElement, options: GoogleButtonOptions): void;
  cancel(): void;
  disableAutoSelect(): void;
}

export interface GoogleAccountsNamespace {
  accounts: { id: GoogleAccountsId };
}

/** The library attaches itself to window.google once the script has loaded. */
export type WindowWithGoogle = Window & { google?: GoogleAccountsNamespace };
