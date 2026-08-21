import { Firestore } from "@google-cloud/firestore";

/**
 * The app's one Firestore client. Extracted from lib/ghl/store.ts so every
 * module that needs Firestore (GHL token storage, tenant registry, audit log,
 * the webhook dead letter queue) shares one connection instead of each
 * opening its own.
 */
let db: Firestore | null = null;

export function firestore(): Firestore {
  if (!db) {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) {
      // No fallback, on purpose — an unset env var used to silently connect
      // to the real production project id instead of failing. .env.local
      // and the Cloud Run deploy both set this explicitly; if it's missing,
      // that's a real misconfiguration to surface immediately, not paper
      // over with a guess at which project was meant.
      throw new Error(
        "GOOGLE_CLOUD_PROJECT is not set. Refusing to connect to Firestore with an unknown/default project.",
      );
    }
    db = new Firestore({
      projectId,
      ignoreUndefinedProperties: true,
    });
  }
  return db;
}
