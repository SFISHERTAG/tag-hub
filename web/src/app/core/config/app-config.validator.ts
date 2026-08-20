import type { AppConfig } from './app-config';

/**
 * Fails the app at startup on a malformed config, rather than at the first
 * request that happens to need the missing value.
 *
 * This mirrors the rule CLAUDE.md states for `lib/config.ts`: a missing or
 * invalid key throws immediately on start. The audit's motivating case was a
 * deploy silently falling back to the production project id because nothing
 * checked. The frontend equivalent is subtler and worth naming: `apiBaseUrl`
 * accidentally set to a full origin turns every request cross-origin, at which
 * point the SameSite=lax session cookie stops being sent and every call 401s
 * with no obvious cause.
 *
 * Deliberately strict about the shape rather than clever about repair. A config
 * this small has no ambiguous cases, and a validator that guesses is a validator
 * that hides the bug it was written to catch.
 */
export function validateAppConfig(config: AppConfig): void {
  const problems: string[] = [];

  if (typeof config.production !== 'boolean') {
    problems.push('`production` must be a boolean');
  }

  if (typeof config.apiBaseUrl !== 'string') {
    problems.push('`apiBaseUrl` must be a string (empty means same-origin)');
  } else if (config.apiBaseUrl !== '') {
    if (/^https?:\/\//i.test(config.apiBaseUrl)) {
      problems.push(
        '`apiBaseUrl` must not be an absolute URL. The bundle is served same-origin with the ' +
          'API so the httpOnly SameSite=lax session cookie is sent; an absolute URL makes every ' +
          'request cross-origin and every authenticated call fail.',
      );
    } else if (config.apiBaseUrl.startsWith('//')) {
      // Protocol-relative, so still cross-origin, but it satisfies a naive
      // "starts with /" check. Same consequence as an absolute URL.
      problems.push(
        '`apiBaseUrl` must not be protocol-relative ("//host"). That is still cross-origin, ' +
          'so the session cookie is not sent.',
      );
    } else if (!config.apiBaseUrl.startsWith('/')) {
      problems.push('`apiBaseUrl` must start with "/" when it is not empty');
    } else if (config.apiBaseUrl.endsWith('/')) {
      // Otherwise `${apiBaseUrl}/api/x` yields a double slash, which some
      // routers treat as a different path.
      problems.push('`apiBaseUrl` must not end with a trailing "/"');
    }
  }

  if (typeof config.googleClientId !== 'string') {
    problems.push('`googleClientId` must be a string (empty means Google sign-in is off)');
  } else if (config.googleClientId !== '' && !config.googleClientId.endsWith('.apps.googleusercontent.com')) {
    // A truncated or wrong-field paste fails at render time inside Google's
    // script with an opaque message, so catch the shape here instead.
    problems.push(
      '`googleClientId` does not look like a Google client id (expected it to end with ' +
        '".apps.googleusercontent.com"). Leave it empty to disable Google sign-in.',
    );
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid AppConfig:\n${problems.map((p) => `  - ${p}`).join('\n')}\n` +
        'Fix src/environments/environment.ts (or environment.prod.ts).',
    );
  }
}
