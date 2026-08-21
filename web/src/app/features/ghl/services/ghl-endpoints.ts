/**
 * Every GHL endpoint hangs off one location. The id is built here, once.
 *
 * `encodeURIComponent` on each path segment is not decoration: the location id
 * arrives from the URL bar, and the appointment/contact/opportunity ids arrive
 * from a response. A stray slash would silently address a different endpoint
 * rather than fail, and the server would answer 400 or 404 with no clue why.
 *
 * The id in a path is a QUESTION, never an answer. Nothing here grants
 * anything: `requireApiLocationAccess` checks the id against the session on
 * every request, and lib/ghl/client.ts checks it again before it calls GHL.
 */
export function locationBase(locationId: string): string {
  return `/api/ghl/locations/${encodeURIComponent(locationId)}`;
}

export function opportunityPath(locationId: string, opportunityId: string, action: string): string {
  return `${locationBase(locationId)}/opportunities/${encodeURIComponent(opportunityId)}/${action}`;
}

export function contactPath(locationId: string, contactId: string, suffix = ''): string {
  return `${locationBase(locationId)}/contacts/${encodeURIComponent(contactId)}${suffix}`;
}

export function appointmentPath(
  locationId: string,
  appointmentId: string,
  action: string,
): string {
  return `${locationBase(locationId)}/appointments/${encodeURIComponent(appointmentId)}/${action}`;
}
