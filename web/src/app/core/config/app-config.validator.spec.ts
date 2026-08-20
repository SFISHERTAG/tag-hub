import { validateAppConfig } from './app-config.validator';
import { environment } from '../../../environments/environment';
import type { AppConfig } from './app-config';

/**
 * Story: CLAUDE.md requires config to be validated at startup so a bad value
 * fails immediately instead of at the first request that needed it. The failure
 * this guards against on the frontend is quiet: set `apiBaseUrl` to an absolute
 * URL and every request goes cross-origin, the SameSite=lax session cookie stops
 * being sent, and the app 401s everywhere with nothing pointing at the cause.
 */

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return { production: false, apiBaseUrl: '', googleClientId: '', ...overrides };
}

describe('validateAppConfig', () => {
  it('accepts the shipped development environment', () => {
    // The real file, not a fixture — a validator that only ever sees fixtures
    // cannot tell you the app will actually boot.
    expect(() => validateAppConfig(environment)).not.toThrow();
  });

  it('accepts an empty apiBaseUrl, meaning same-origin', () => {
    expect(() => validateAppConfig(config({ apiBaseUrl: '' }))).not.toThrow();
  });

  it('accepts a rooted relative prefix', () => {
    expect(() => validateAppConfig(config({ apiBaseUrl: '/backend' }))).not.toThrow();
  });

  it('rejects an absolute URL, and says why', () => {
    expect(() => validateAppConfig(config({ apiBaseUrl: 'https://api.example.com' }))).toThrow(
      /same-origin/,
    );
  });

  it('rejects a protocol-relative URL', () => {
    // Slips past a naive "starts with /" check while still being cross-origin.
    expect(() => validateAppConfig(config({ apiBaseUrl: '//api.example.com' }))).toThrow();
  });

  it('rejects an unrooted prefix', () => {
    expect(() => validateAppConfig(config({ apiBaseUrl: 'backend' }))).toThrow(/start with/);
  });

  it('rejects a trailing slash, which would produce a double slash in every URL', () => {
    expect(() => validateAppConfig(config({ apiBaseUrl: '/backend/' }))).toThrow(/trailing/);
  });

  it('rejects a non-boolean production flag', () => {
    expect(() =>
      validateAppConfig(config({ production: 'yes' as unknown as boolean })),
    ).toThrow(/boolean/);
  });

  it('reports every problem at once rather than one per run', () => {
    let message = '';
    try {
      validateAppConfig({
        production: 'yes' as unknown as boolean,
        apiBaseUrl: 'https://api.example.com',
        googleClientId: '',
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('production');
    expect(message).toContain('apiBaseUrl');
  });

  describe('googleClientId', () => {
    it('accepts an empty value, which means Google sign-in is off', () => {
      expect(() => validateAppConfig(config({ googleClientId: '' }))).not.toThrow();
    });

    it('accepts a well-formed client id', () => {
      expect(() =>
        validateAppConfig(config({ googleClientId: '123-abc.apps.googleusercontent.com' })),
      ).not.toThrow();
    });

    it('rejects a truncated paste', () => {
      // Fails at render time inside Google's script with an opaque message
      // otherwise, which is a miserable thing to debug.
      expect(() => validateAppConfig(config({ googleClientId: '123-abc' }))).toThrow(
        /apps\.googleusercontent\.com/,
      );
    });
  });
});
