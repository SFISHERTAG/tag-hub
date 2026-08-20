import "server-only";
import type { Session, ImpersonationState } from "./session";
import type { Role } from "./roles";

/**
 * The single body shape every session-resolving or session-changing endpoint
 * returns, and the only thing the Angular client is allowed to derive its
 * session from.
 *
 * The client rule is absolute: REPLACE the whole session object with this,
 * never merge, never patch a field. `locations` is a derived function of
 * `currentRole` (lib/auth/session.ts:113-126) and for tag_exec, tag_csd and
 * admin it is the awaited result of listAllLocationIds(). There is no
 * browser-side expression that produces it, so a partial update silently
 * desynchronises tenant access from the displayed hat — which is the entire
 * class of bug story 10.2 exists to close.
 *
 * `impersonation` rides along rather than living on its own endpoint. The
 * hub_impersonation cookie is httpOnly, so the browser cannot read it; without
 * this field the banner would vanish on every reload while the access it
 * describes remained live.
 */
export type SessionPayload = {
  uid: string;
  email: string | null;
  currentRole: Role;
  availableRoles: Role[];
  locations: string[];
  impersonation: { locationId: string } | null;
};

/**
 * Builds the payload from an explicit impersonation state.
 *
 * The state is a PARAMETER, deliberately, rather than being read inside via
 * getImpersonation(). That function reads `cookies()`, which is the INCOMING
 * request jar — but every route that changes impersonation writes its cookie on
 * the OUTGOING response. A builder that re-read the jar would report the
 * pre-request state on exactly the four routes whose purpose is to change it:
 * enter would answer `null`, and exit would answer with the impersonation it
 * just ended. Combined with the replace-never-merge rule above, that is a live
 * authorization desync, not a cosmetic one.
 *
 * So each caller passes what the response is about to carry: the freshly created
 * state on enter, null on exit and on a role switch that clears, and
 * `await getImpersonation()` only on the read-only session probe.
 *
 * Fields are copied one at a time on purpose. Spreading the decoded token from
 * verifySessionCookie, or returning roleGrants, would hand the browser
 * iss/aud/sub/auth_time and the full grant map — none of which it needs and all
 * of which are useful to an attacker reading a cached response.
 */
export function buildSessionPayload(
  session: Session,
  impersonation: ImpersonationState | null,
): SessionPayload {
  return {
    uid: session.uid,
    email: session.email,
    currentRole: session.currentRole,
    availableRoles: session.availableRoles,
    locations: session.locations,
    // Only the location id. auditEntryId and actorId are internal correlation
    // values with no client use, and echoing actorId back would confirm to a
    // caller holding a forged cookie whose session it was minted against.
    impersonation: impersonation ? { locationId: impersonation.locationId } : null,
  };
}
