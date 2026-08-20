import type { AppConfig } from '../app/core/config/app-config';

/** Production configuration. See environment.ts — nothing secret goes here. */
export const environment: AppConfig = {
  production: true,
  apiBaseUrl: '',
  // Set from GOOGLE_SIGNIN_CLIENT_ID once the OAuth client exists. Empty means
  // the Google button is not rendered; the OTP flow is unaffected.
  googleClientId: '',
};
