import "server-only";

/**
 * The public origin of this deployment, for links that are emailed out.
 *
 * Read from configuration, never from the incoming request. That is the whole
 * point of this module existing rather than a one-line header read.
 *
 * A sign-in link built from the `Host` header is the classic host-header
 * injection: an attacker sends a request carrying `Host: evil.example`, the
 * server mints a link at that host and mails it to the account's real owner,
 * and clicking it hands the code to the attacker. The header is attacker
 * controlled on any deployment that does not pin it, so it cannot be the
 * source of truth for something we put in an email.
 *
 * `request.nextUrl.origin` is not an option either: inside Cloud Run it is the
 * container's own bind address, which is what put `https://0.0.0.0:8080` into
 * the sign-out redirect.
 */
export class BaseUrlNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BaseUrlNotConfiguredError";
  }
}

/**
 * Returns the configured origin with no trailing slash, or throws.
 *
 * Throwing rather than falling back: a wrong origin here produces sign-in links
 * that silently go nowhere, or somewhere else entirely. A missing code is a
 * visible failure, a subtly wrong link is not.
 */
export function publicBaseUrl(): string {
  const raw = process.env.PUBLIC_BASE_URL?.trim();

  if (!raw) {
    throw new BaseUrlNotConfiguredError(
      "PUBLIC_BASE_URL is not set. It must be the origin this deployment is " +
        "reached at, for example https://hub.example.com or http://localhost:3000.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new BaseUrlNotConfiguredError(
      `PUBLIC_BASE_URL is not a valid URL: "${raw}". Include the scheme.`,
    );
  }

  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new BaseUrlNotConfiguredError(
      `PUBLIC_BASE_URL must be https outside local development: "${raw}". ` +
        "A sign-in code sent over plaintext http is readable in transit.",
    );
  }

  return parsed.origin;
}

/**
 * The one-click sign-in link for a code.
 *
 * The credentials ride in the URL **fragment**, not the query string, and that
 * distinction is doing real work:
 *
 *   - A fragment is never transmitted to the server, so the code stays out of
 *     Cloud Run's request logs, out of any proxy's logs, and out of `Referer`
 *     headers sent to third parties from the page.
 *   - A mail scanner that pre-fetches links issues a GET, and a GET of the
 *     sign-in page conveys nothing and consumes nothing. The code is only spent
 *     by the POST to `/api/auth/otp/verify`, which the page makes after it
 *     reads the fragment in the browser.
 *
 * The residual risk is a scanner that both follows fragments and executes
 * JavaScript, which would burn the code before the recipient clicks. That is
 * rare, and the failure is recoverable: the user requests another code.
 */
export function signInLink(email: string, code: string): string {
  const fragment = new URLSearchParams({ e: email, c: code }).toString();
  return `${publicBaseUrl()}/signin#${fragment}`;
}
