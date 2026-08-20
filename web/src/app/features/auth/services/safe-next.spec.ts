import { safeNext } from './safe-next';

/**
 * Story: authGuard writes the attempted URL into `?next=`, and sign-in reads it
 * back. Handing that value to the router unchecked is an open redirect, and
 * sign-in is the worst place to have one: a victim who has just typed
 * credentials is primed to type them again on whatever page appears next.
 */
describe('safeNext', () => {
  it('keeps an ordinary in-app path', () => {
    expect(safeNext('/l/loc1/pipeline')).toBe('/l/loc1/pipeline');
  });

  it('keeps a path with a query string', () => {
    expect(safeNext('/portfolio?view=escalations')).toBe('/portfolio?view=escalations');
  });

  it('rejects an absolute URL', () => {
    expect(safeNext('https://evil.example.com')).toBe('/');
  });

  it('rejects a protocol-relative URL', () => {
    // Passes a naive "starts with /" check and still leaves the origin.
    expect(safeNext('//evil.example.com')).toBe('/');
  });

  it('rejects a backslash path', () => {
    // Some browsers treat a backslash as a separator, so this escapes the origin.
    expect(safeNext('/\\evil.example.com')).toBe('/');
  });

  it('rejects an embedded control character', () => {
    expect(safeNext('/java\tscript:alert(1)')).toBe('/');
    expect(safeNext('/path\u0000')).toBe('/');
  });

  it('rejects a bare word', () => {
    expect(safeNext('evil.example.com')).toBe('/');
  });

  it('rejects sign-in itself, which would loop', () => {
    expect(safeNext('/signin')).toBe('/');
    expect(safeNext('/signin?next=%2F')).toBe('/');
  });

  it.each([null, undefined, ''])('falls back for %s', (value) => {
    expect(safeNext(value)).toBe('/');
  });
});
