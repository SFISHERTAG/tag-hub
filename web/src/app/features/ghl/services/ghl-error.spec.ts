import { classifyGhlError } from './ghl-error';
import type { ApiError } from '../../../core/models/api-result.model';

function error(status: number | undefined, message = 'Something happened.'): ApiError {
  return { message, context: 'GET /api/ghl/locations/loc1/pipeline', status };
}

/**
 * Story: the retry button is the load-bearing output here.
 *
 * A 503 means this tenant has no working GoHighLevel connection. That is a job
 * for a human with admin access, and "Try again" turns a clear instruction into
 * a loop that never terminates. A 502 means GHL itself failed, which retrying
 * can genuinely fix.
 *
 * The server's own sentence always survives into `detail`, because it is the
 * actionable half — "Reconnect the location in GoHighLevel" tells someone what
 * to do; "That did not load" does not.
 */
describe('classifyGhlError', () => {
  it('does not offer a retry for a tenant that is not connected', () => {
    const failure = classifyGhlError(error(503, 'GHL is not configured for this location.'));

    expect(failure.kind).toBe('setup');
    expect(failure.retryable).toBe(false);
    expect(failure.detail).toBe('GHL is not configured for this location.');
  });

  it('offers a retry when GoHighLevel itself failed', () => {
    const failure = classifyGhlError(error(502, 'GHL 500: upstream'));

    expect(failure.kind).toBe('upstream');
    expect(failure.retryable).toBe(true);
  });

  it('does not retry a refused tenant', () => {
    // The API decided. Asking again produces the same 403 and teaches the
    // reader nothing.
    expect(classifyGhlError(error(403)).retryable).toBe(false);
    expect(classifyGhlError(error(403)).kind).toBe('access');
  });

  it('does not retry a 401, because authInterceptor already tried', () => {
    expect(classifyGhlError(error(401)).retryable).toBe(false);
  });

  it('treats an unknown or transport failure as retryable', () => {
    expect(classifyGhlError(error(undefined, 'Http failure')).kind).toBe('unknown');
    expect(classifyGhlError(error(undefined)).retryable).toBe(true);
    expect(classifyGhlError(error(500)).retryable).toBe(true);
  });

  it('always carries the server sentence through', () => {
    expect(classifyGhlError(error(404, 'Contact not found.')).detail).toBe('Contact not found.');
  });
});
