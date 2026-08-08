import "server-only";
import { Firestore } from "@google-cloud/firestore";

/**
 * Persistence for OAuth credentials.
 *
 * Two ways a location becomes reachable:
 *
 *   1. Agency install — one company token that mints short-lived location
 *      tokens on demand. This is how all 40 sub-accounts get served.
 *
 *   2. Direct location install — the app installed onto a single sub-account.
 *      Yields a location token with its own refresh token. Useful for testing
 *      against one client before rolling out agency-wide.
 *
 * Both paths write a document under `ghl/agency/locations/{locationId}`, so
 * token resolution does not care which one produced it.
 */

let db: Firestore | null = null;

function firestore(): Firestore {
  if (!db) {
    db = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT || "tag-success-hub",
      ignoreUndefinedProperties: true,
    });
  }
  return db;
}

const AGENCY_DOC = "ghl/agency";
const locationDoc = (locationId: string) =>
  `ghl/agency/locations/${locationId}`;

export type StoredAgencyToken = {
  accessToken: string;
  refreshToken: string;
  companyId: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  updatedAt: number;
};

export async function saveAgencyToken(token: StoredAgencyToken): Promise<void> {
  await firestore().doc(AGENCY_DOC).set(token);
}

export async function loadAgencyToken(): Promise<StoredAgencyToken | null> {
  const snapshot = await firestore().doc(AGENCY_DOC).get();
  return snapshot.exists ? (snapshot.data() as StoredAgencyToken) : null;
}

export type StoredLocationToken = {
  accessToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  /** Present only for direct installs; minted tokens are re-minted instead. */
  refreshToken?: string;
  /** How this credential was obtained. */
  source: "agency-mint" | "direct-install";
  updatedAt: number;
};

export async function saveLocationToken(
  locationId: string,
  token: StoredLocationToken,
): Promise<void> {
  await firestore().doc(locationDoc(locationId)).set(token);
}

export async function loadLocationToken(
  locationId: string,
): Promise<StoredLocationToken | null> {
  const snapshot = await firestore().doc(locationDoc(locationId)).get();
  return snapshot.exists ? (snapshot.data() as StoredLocationToken) : null;
}

/** Locations with a stored credential, whatever its source. */
export async function listStoredLocationIds(): Promise<string[]> {
  const snapshot = await firestore()
    .collection("ghl/agency/locations")
    .listDocuments();
  return snapshot.map((doc) => doc.id);
}
