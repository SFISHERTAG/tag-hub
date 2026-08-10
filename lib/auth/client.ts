"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

/**
 * Firebase Web SDK, browser only.
 *
 * These values are public by design — they identify the project, they do not
 * grant access to it. Access is decided by Identity Platform and by the
 * server-side session verification in `lib/auth/session.ts`. Nothing secret
 * belongs in this file.
 */

let cachedApp: FirebaseApp | null = null;

function app(): FirebaseApp {
  if (cachedApp) return cachedApp;

  const existing = getApps();
  if (existing.length > 0) {
    cachedApp = existing[0];
    return cachedApp;
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!apiKey || !authDomain || !projectId) {
    throw new Error(
      "Firebase web config missing. Set NEXT_PUBLIC_FIREBASE_API_KEY, " +
        "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, and NEXT_PUBLIC_FIREBASE_PROJECT_ID " +
        "in hub/.env.local.",
    );
  }

  cachedApp = initializeApp({ apiKey, authDomain, projectId });
  return cachedApp;
}

export function clientAuth(): Auth {
  return getAuth(app());
}
