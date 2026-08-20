import type { AppConfig } from '../app/core/config/app-config';

/**
 * Development configuration.
 *
 * Nothing secret belongs in this file or its production sibling. Everything
 * here ships inside the browser bundle, so "environment variable" does not mean
 * what it means on the server: a value here is public the moment it deploys.
 * API keys, project ids and connection strings stay server-side and are reached
 * through an endpoint, never embedded.
 *
 * `apiBaseUrl` is empty by design. The Angular bundle is served same-origin with
 * the API, which is what keeps the httpOnly SameSite=lax `hub_session` cookie
 * working, so every request is relative. In development, proxy.conf.json
 * forwards /api to the Next dev server to preserve that same-origin illusion.
 */
export const environment: AppConfig = {
  production: false,
  apiBaseUrl: '',
};
