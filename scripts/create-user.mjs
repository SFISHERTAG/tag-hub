#!/usr/bin/env node
/**
 * Creates or updates a Hub user.
 *
 * There is no self-signup — accounts are created by TAG. Sign-in is by
 * six-digit email code, so no password is set or needed.
 *
 * Usage:
 *   node scripts/create-user.mjs someone@taxadvisorygrowth.net
 *   node scripts/create-user.mjs someone@taxadvisorygrowth.net --role tag_exec
 *
 * Roles are the full set from docs/prd.md. `tag_exec` is the closest thing to
 * a super admin: it reaches every location rather than an enumerated list.
 * Location claims arrive properly in Story 1.4; this sets the role now.
 */

import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const ROLES = [
  "tag_sales",
  "tag_sales_manager",
  "tag_csm",
  "tag_exec",
  "client_closer",
  "client_manager",
  "client_owner",
];

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--"));
const roleIndex = args.indexOf("--role");
const role = roleIndex !== -1 ? args[roleIndex + 1] : undefined;

if (!email || !email.includes("@")) {
  console.error("Usage: node scripts/create-user.mjs <email> [--role <role>]");
  console.error(`Roles: ${ROLES.join(", ")}`);
  process.exit(1);
}

if (role && !ROLES.includes(role)) {
  console.error(`Unknown role "${role}".`);
  console.error(`Roles: ${ROLES.join(", ")}`);
  process.exit(1);
}

// No fallback, on purpose — this script creates real users and grants real
// roles (including tag_exec, "the closest thing to a super admin"). An
// unset env var silently defaulting to the production project means a
// mistyped command grants production access instead of failing loudly.
const projectId = process.env.GOOGLE_CLOUD_PROJECT;
if (!projectId) {
  console.error("GOOGLE_CLOUD_PROJECT is not set. Refusing to run against an unknown/default project.");
  process.exit(1);
}
console.log(`Targeting Firebase project: ${projectId}`);
if (getApps().length === 0) initializeApp({ projectId });
const auth = getAuth();

let user;
try {
  user = await auth.getUserByEmail(email);
  console.log(`Found existing user ${user.email}`);
} catch {
  user = await auth.createUser({
    email,
    emailVerified: true, // created by TAG, not self-registered
  });
  console.log(`Created ${user.email}`);
}

console.log(`  uid: ${user.uid}`);

if (role) {
  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), role });
  console.log(`  role: ${role}`);
  console.log("\nClaims refresh on next sign-in. Sign out and back in if already signed in.");
} else if (user.customClaims?.role) {
  console.log(`  role: ${user.customClaims.role} (unchanged)`);
} else {
  console.log("  role: none — pass --role to set one");
}
