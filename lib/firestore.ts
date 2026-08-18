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
      throw new Error(
        "GOOGLE_CLOUD_PROJECT is not set. Refusing to guess a project.",
      );
    }
    db = new Firestore({
      projectId,
      ignoreUndefinedProperties: true,
    });
  }
  return db;
}
