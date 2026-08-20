import type { AppConfig } from '../app/core/config/app-config';

/** Production configuration. See environment.ts — nothing secret goes here. */
export const environment: AppConfig = {
  production: true,
  apiBaseUrl: '',
  // Public by design: it ships in this bundle and identifies the app rather
  // than authorising anything. The matching client secret is NOT used by the
  // Sign in with Google flow and must never appear in this repo.
  googleClientId: '872900877746-krfb0k16i2279qhkbqq93162sqvrjf4g.apps.googleusercontent.com',
};
