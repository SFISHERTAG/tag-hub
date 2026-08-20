import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import { RBAC_SERVICE } from '../../../core/services/rbac.service';
import type { Session } from '../../../core/models/session.model';
import type { ApiResult } from '../../../core/models/api-result.model';

const REQUEST_URL = '/api/auth/otp/request';
const VERIFY_URL = '/api/auth/otp/verify';
const SIGNOUT_URL = '/api/auth/signout';
const GOOGLE_URL = '/api/auth/google';

/** Shape of the request endpoint's success body. */
export interface CodeRequested {
  ok: true;
  /** Present only when a resend was refused; the client shows a countdown. */
  cooldown?: boolean;
  retryAfterSeconds?: number;
}

/**
 * The OTP sign-in flow.
 *
 * Note what is NOT here: any Firebase call. The custom-token exchange happens
 * server-side, so `verify` receives a session payload and a Set-Cookie and this
 * app carries no Firebase dependency at all. The endpoint used to return a
 * custom token in a readable JSON body, which is a bearer credential for that
 * uid handed to page script.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly rbac = inject(RBAC_SERVICE);

  /**
   * Asks for a code. Succeeds whether or not the address has an account: there
   * is no self-signup, so an endpoint that distinguished the two would let
   * anyone enumerate which of TAG's clients have accounts.
   */
  requestCode(email: string): Promise<ApiResult<CodeRequested>> {
    return firstValueFrom(this.api.post<CodeRequested>(REQUEST_URL, { email }));
  }

  /**
   * Verifies a code. On success the session cookie is already set by the
   * response, so the payload is applied directly rather than re-fetched.
   */
  async verifyCode(email: string, code: string): Promise<ApiResult<Session>> {
    const result = await firstValueFrom(this.api.post<Session>(VERIFY_URL, { email, code }));
    if (!result.error) this.rbac.applySession(result.data);
    return result;
  }

  /**
   * Exchanges a Google Identity Services credential for a session.
   *
   * The credential is an ID token, verified server-side against our own client
   * id as the expected audience. Nothing about it is trusted here: this method
   * only carries it across.
   */
  async signInWithGoogle(credential: string): Promise<ApiResult<Session>> {
    const result = await firstValueFrom(this.api.post<Session>(GOOGLE_URL, { credential }));
    if (!result.error) this.rbac.applySession(result.data);
    return result;
  }

  /**
   * Signs out. Clears local state regardless of the outcome: if the call
   * failed, leaving the app looking signed in is worse than optimistically
   * clearing, since the cookie may well be gone anyway and every subsequent
   * request will 401.
   */
  async signOut(): Promise<void> {
    await firstValueFrom(this.api.post<{ ok: true }>(SIGNOUT_URL, {}));
    this.rbac.applySession(null);
  }
}
