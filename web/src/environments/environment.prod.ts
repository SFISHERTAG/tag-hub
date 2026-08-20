import type { AppConfig } from '../app/core/config/app-config';

/** Production configuration. See environment.ts — nothing secret goes here. */
export const environment: AppConfig = {
  production: true,
  apiBaseUrl: '',
};
