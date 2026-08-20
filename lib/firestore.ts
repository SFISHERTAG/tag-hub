import { Firestore } from "@google-cloud/firestore";
import { assertRuntimeConfig, gcpProjectId } from "./config";

// Fail on start, not on the first request that happens to touch the database.
assertRuntimeConfig();

/**
 * The app's one Firestore client. Extracted from lib/ghl/store.ts so every
 * module that needs Firestore (GHL token storage, tenant registry, audit log,
 * the webhook dead letter queue) shares one connection instead of each
 * opening its own.
 */
let db: Firestore | null = null;

export function firestore(): Firestore {
  if (!db) {
    db = new Firestore({
      projectId: gcpProjectId(),
      ignoreUndefinedProperties: true,
    });
  }
  return db;
}
