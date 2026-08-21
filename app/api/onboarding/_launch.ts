import "server-only";
import { getImpersonation, type Session } from "@/lib/auth/session";
import { ROLES } from "@/lib/auth/roles";
import { badRequest, type JsonBody } from "../admin/_lib/http";

/**
 * Onboarding and campaign launch are TAG-side work: the executive view and the
 * CSM who owns the account. Matches the legacy page gate exactly.
 *
 * Deliberately narrower than the legacy `markTaskComplete` action, which
 * allowed any non-client role via `isClientUser`. That helper names only three
 * of the five client roles (see the note in lib/auth/session.ts), so
 * `!isClientUser(role)` reported a client's setter as internal — and the only
 * screen that ever called the action was gated to these two anyway. A positive
 * allowlist fails in the safe direction.
 */
export const ONBOARDING_ROLES = [ROLES.TAG_EXEC, ROLES.TAG_CSM] as const;

/**
 * The copy shown before activation, kept here so the confirmation the screen
 * renders and the message the API rejects an unconfirmed call with cannot
 * drift apart.
 */
export const ACTIVATION_WARNING =
  "Activating starts real ad spend on this client's Meta ad account immediately. " +
  "The campaign is created paused; nothing spends until this step.";

/**
 * Which client this request is about.
 *
 * An explicit `locationId` wins, because the Angular app carries the selected
 * client in its own routing rather than relying on a cookie. It is a caller
 * supplied id and is worth nothing on its own — every caller of this passes
 * the result through `requireApiLocationAccess` before it reaches lib/.
 *
 * Falling back to the impersonation cookie preserves the legacy behaviour: a
 * CSM who entered a client from Portfolio (Story 3.3) gets that client without
 * having to name it again. The cookie is only honoured when its `actorId` is
 * the caller, so a stale or planted cookie belonging to someone else resolves
 * to nothing.
 */
export async function resolveLocationId(
  session: Session,
  requested: string | null | undefined,
): Promise<string | null> {
  const explicit = (requested ?? "").trim();
  if (explicit) return explicit;

  const impersonation = await getImpersonation();
  if (impersonation && impersonation.actorId === session.uid) {
    return impersonation.locationId;
  }
  return null;
}

/**
 * The five raw campaign fields, normalised to the strings
 * `parseCampaignFormInputs` expects.
 *
 * Numbers are accepted as well as strings because a JSON client naturally
 * sends `budget: 3000`, while the parser's contract is the raw text a form
 * produced. Coercing here keeps that contract intact — the validation rules
 * stay in one place in lib/ — without forcing every caller to stringify first.
 */
export function readRawCampaignInputs(body: JsonBody): {
  client: string;
  offer: string;
  budget: string;
  cap: string;
  pixel: string;
} {
  const field = (key: string): string => {
    const value = body[key];
    if (value === undefined || value === null) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    throw badRequest(`"${key}" must be a string or a number.`);
  };

  return {
    client: field("client"),
    offer: field("offer"),
    budget: field("budget"),
    cap: field("cap"),
    pixel: field("pixel"),
  };
}
