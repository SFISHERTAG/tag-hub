import "server-only";
import { mintLocationToken, refreshAgencyToken } from "./oauth";
import {
  loadAgencyToken,
  loadLocationToken,
  saveAgencyToken,
  saveLocationToken,
  listStoredLocationIds,
  type StoredAgencyToken,
} from "./store";

/**
 * Token resolution for GHL API calls.
 *
 * Callers ask for a token by location and never learn where it came from.
 * Resolution is tried in this order:
 *
 *   1. A cached location token that is still valid.
 *   2. A direct-install token, refreshed via its own refresh token.
 *   3. A freshly minted token from the agency install that owns the location.
 *      Agency tokens are keyed by company, so a location minted through one
 *      agency is never re-minted through another's credential.
 *   4. The development Private Integration Token, for the single location
 *      named in GHL_LOCATION_ID.
 *
 * Each tier's failure falls through to the next rather than aborting the
 * chain — a location can lose its direct-install credential (tier 2, e.g. a
 * revoked refresh token) while the agency install (tier 3) can still mint it
 * a token, and losing both of those still shouldn't crash a dev environment
 * that only needs the PIT (tier 4). Only tier 4 actually throws: a
 * `GhlConfigError` if no PIT is configured at all, or a
 * `LocationNotAuthorizedError` if the PIT exists but isn't for this location.
 *
 * Firestore being unreachable is not fatal in development — resolution falls
 * through to the PIT rather than crashing, so local work continues without
 * `gcloud auth application-default login`.
 */

/** Refresh slightly early so a token cannot expire mid-request. */
const EXPIRY_SKEW_MS = 60_000;

export class GhlConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GhlConfigError";
  }
}

export class LocationNotAuthorizedError extends Error {
  constructor(readonly locationId: string) {
    super(
      `No GHL credential available for location ${locationId}. ` +
        `Install the app on that sub-account, or complete the agency install ` +
        `to reach every sub-account at once.`,
    );
    this.name = "LocationNotAuthorizedError";
  }
}

export function devLocationId(): string | undefined {
  return process.env.GHL_LOCATION_ID?.trim() || undefined;
}

function devToken(): string | undefined {
  // Trailing newlines are easy to introduce when pasting into a terminal or
  // loading from a file, and they break the Authorization header silently.
  return process.env.GHL_PIT?.trim() || undefined;
}

function isFresh(expiresAt: number | undefined): boolean {
  return typeof expiresAt === "number" && expiresAt > Date.now() + EXPIRY_SKEW_MS;
}

/** Returns a valid agency access token, refreshing it first if needed. */
async function validAgencyAccessToken(
  stored: StoredAgencyToken,
): Promise<string> {
  if (isFresh(stored.expiresAt)) return stored.accessToken;

  const refreshed = await refreshAgencyToken(stored.refreshToken);
  await saveAgencyToken({
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? stored.refreshToken,
    companyId: refreshed.companyId ?? stored.companyId,
    expiresAt: Date.now() + refreshed.expires_in * 1000,
    updatedAt: Date.now(),
  });
  return refreshed.access_token;
}

export async function resolveToken(locationId: string): Promise<string> {
  try {
    // 1. Cached location token, still valid.
    const stored = await loadLocationToken(locationId);
    if (stored && isFresh(stored.expiresAt)) {
      return stored.accessToken;
    }

    // 2. Direct install — refresh with its own refresh token. A failure here
    // (revoked/expired refresh token) falls through to tier 3 instead of
    // aborting the whole chain: the agency install can often still mint a
    // token for this location even when its own direct-install credential
    // can't be refreshed. Scoped to its own try/catch so this failure
    // doesn't reach the outer catch, which would skip tier 3 entirely.
    if (stored?.refreshToken) {
      try {
        const refreshed = await refreshAgencyToken(stored.refreshToken);
        await saveLocationToken(locationId, {
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token ?? stored.refreshToken,
          expiresAt: Date.now() + refreshed.expires_in * 1000,
          source: "direct-install",
          updatedAt: Date.now(),
        });
        return refreshed.access_token;
      } catch (tier2Error) {
        console.warn(
          `[GHL tokens] Tier 2 (direct-install refresh) failed for ${locationId}, falling through to tier 3 (agency-mint):`,
          tier2Error,
        );
      }
    }

    // 3. Mint from the agency install. A location records which agency it is
    // reachable through the first time it is minted, so a re-mint goes back to
    // the same company. Only a location that predates that field falls back to
    // the primary: minting is company-scoped, so trying other agencies in turn
    // would just be probing for a location we were never granted.
    const agency = await loadAgencyToken(stored?.agencyCompanyId);
    if (agency) {
      const agencyAccess = await validAgencyAccessToken(agency);
      const minted = await mintLocationToken(
        agencyAccess,
        agency.companyId,
        locationId,
      );
      await saveLocationToken(locationId, {
        accessToken: minted.access_token,
        expiresAt: Date.now() + minted.expires_in * 1000,
        source: "agency-mint",
        agencyCompanyId: agency.companyId,
        updatedAt: Date.now(),
      });
      return minted.access_token;
    }
  } catch (error) {
    // Only swallow this when a PIT can cover the request; otherwise the caller
    // deserves the real reason.
    const canFallBack = devToken() && locationId === devLocationId();
    if (!canFallBack) throw error;
  }

  // 4. Development fallback.
  const pit = devToken();
  const configured = devLocationId();

  if (!pit) {
    throw new GhlConfigError(
      "No GHL credential available. Install the app, or set GHL_PIT in " +
        "hub/.env.local for single-location development.",
    );
  }
  if (locationId !== configured) {
    throw new LocationNotAuthorizedError(locationId);
  }
  return pit;
}

/** Locations this deployment can currently serve. */
export async function authorizedLocationIds(): Promise<string[]> {
  const ids = new Set<string>();

  try {
    for (const id of await listStoredLocationIds()) ids.add(id);
  } catch {
    // Firestore unavailable — fall back to whatever development provides.
  }

  const configured = devLocationId();
  if (configured && devToken()) ids.add(configured);

  return [...ids];
}
