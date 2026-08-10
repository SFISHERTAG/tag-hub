import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

/**
 * Firebase Admin, used only on the server.
 *
 * Credentials come from application default credentials — the Cloud Run service
 * account in production, `gcloud auth application-default login` locally. No
 * service-account key file is committed or needed.
 */

let cachedApp: App | null = null;

function app(): App {
  if (cachedApp) return cachedApp;

  const existing = getApps();
  if (existing.length > 0) {
    cachedApp = existing[0];
    return cachedApp;
  }

  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT?.trim() || "tag-success-hub";

  // Minting a custom token means signing a JWT, and signing needs a service
  // account — user credentials cannot do it. Naming the account here lets the
  // SDK sign through the IAM signBlob API instead of holding a private key, so
  // no key file exists to leak. Locally this works because the developer holds
  // Token Creator on the account; on Cloud Run it is the runtime identity.
  const serviceAccountId =
    process.env.FIREBASE_SERVICE_ACCOUNT_ID?.trim() ||
    `hub-app@${projectId}.iam.gserviceaccount.com`;

  // An explicit key is supported for environments with neither ADC nor a
  // metadata server, but is not the expected path.
  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();

  cachedApp = initializeApp(
    rawKey
      ? { projectId, credential: cert(JSON.parse(rawKey)) }
      : { projectId, serviceAccountId },
  );

  return cachedApp;
}

export function adminAuth(): Auth {
  return getAuth(app());
}

/** How long a session cookie stays valid. */
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

export const SESSION_COOKIE = "hub_session";
