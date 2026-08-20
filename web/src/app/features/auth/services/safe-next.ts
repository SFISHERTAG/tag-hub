/**
 * Sanitises the `next` query parameter before it is used as a destination.
 *
 * authGuard puts the attempted URL into `?next=` so sign-in can return the user
 * where they were headed. Passing that value to the router unchecked is an open
 * redirect, and sign-in is the worst place to have one: a link to
 * `/signin?next=https://evil.example.com` sends someone who has just typed their
 * credentials straight to an attacker's page, at the moment they are most primed
 * to type them again.
 *
 * Allow only same-origin paths, expressed as a single leading slash. Anything
 * else falls back to the app root rather than erroring, because a bad `next` is
 * a link the user did not author and should not become an error page.
 */
const FALLBACK = '/';

export function safeNext(value: string | null | undefined): string {
  if (!value) return FALLBACK;

  // Must be a rooted path. Rejects "https://evil.com", bare words, and
  // "//evil.com", which is protocol-relative and leaves the origin while still
  // starting with a slash.
  if (!value.startsWith('/') || value.startsWith('//')) return FALLBACK;

  // Some browsers treat a backslash as a path separator, so "/\evil.com" can
  // escape the origin despite passing the check above.
  if (value.includes('\\')) return FALLBACK;

  // Control characters are used to smuggle a scheme past naive parsers.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return FALLBACK;

  // Returning to sign-in after signing in is a loop, not a destination.
  if (value === '/signin' || value.startsWith('/signin?')) return FALLBACK;

  return value;
}
