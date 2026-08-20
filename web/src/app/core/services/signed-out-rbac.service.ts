import { Injectable, signal } from '@angular/core';
import type { RbacService } from './rbac.service';

/**
 * Production stand-in until the real HTTP-backed RbacService lands (story 10.2).
 *
 * It reports "signed out", always. Every guard then denies and redirects to
 * sign-in, which is the correct posture for an app that genuinely has no
 * session source yet.
 *
 * This exists because the alternative was worse. MockRbacService was provided
 * unconditionally, including in production builds, with a hardcoded `tag_exec`
 * session whose availableRoles included `admin` — so both route guards passed
 * for everyone, in every build, with no session at all. That is fail-open, and
 * the fact that no routes are wired yet is a timing accident, not a safeguard.
 *
 * Deleting the mock outright was the other option, but leaving RBAC_SERVICE
 * unprovided turns a missing session into an injector crash at first render,
 * which reads as a build problem rather than an auth one.
 */
@Injectable()
export class SignedOutRbacService implements RbacService {
  readonly session = signal(null).asReadonly();

  // Parameter deliberately omitted rather than underscore-prefixed: a narrower
  // signature still satisfies RbacService, and it avoids relaxing no-unused-vars
  // repo-wide to accommodate one method.
  switchRole(): void {
    // Nothing to switch. Not an error: the hat switcher only renders for a
    // session with more than one role, so this is unreachable in practice.
  }
}
